"""/users/me/* — kullanıcı profil + uploads + saved + change-password + delete."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import InvalidCredentialsException
from app.core.security import hash_password, verify_password
from app.models.place import Place
from app.models.user import User
from app.models.user_interaction import UserInteraction
from app.repositories.place_repository import PlaceRepository
from app.schemas.auth import UserPublic
from app.schemas.place import PlaceListItem

router = APIRouter()


async def _to_list_items(
    places: list[Place], db: AsyncSession, *, liked: bool | None = None
) -> list[PlaceListItem]:
    """Place modellerini kapak görseli doldurulmuş PlaceListItem'lara çevirir."""
    repo = PlaceRepository(db)
    items: list[PlaceListItem] = []
    for p in places:
        items.append(
            PlaceListItem(
                id=p.id,
                place_name=p.place_name,
                country=p.country,
                city=p.city,
                category=p.category,
                primary_image_url=await repo.primary_image_url(p.id),
                like_count=p.like_count,
                view_count=p.view_count,
                liked=True if liked else False,
                created_at=p.created_at,
            )
        )
    return items


class UpdateMeRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=100)
    preferred_language: str | None = Field(default=None, min_length=2, max_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.put("/me", response_model=UserPublic)
async def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPublic:
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mevcut şifreyi doğrulayıp yenisini kaydeder.

    Sosyal girişle (Google) gelen ve şifresi olmayan hesaplar için
    400 BAD_REQUEST döner; o kullanıcıların şifre belirleyip değiştirmesi
    için ileride ayrı bir akış (set-password) tasarlanabilir.
    """
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu hesap sosyal sağlayıcı ile oluşturulmuş; şifre tanımlı değil.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise InvalidCredentialsException(
            message="Mevcut şifre hatalı.",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre mevcut şifreyle aynı olamaz.",
        )

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Şifre güncellendi."}


@router.get("/me/uploads", response_model=list[PlaceListItem])
async def my_uploads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlaceListItem]:
    """Kullanıcının uygulamaya yüklediği (katkıda bulunduğu) yerler."""
    rows = (
        await db.execute(
            select(Place).where(Place.created_by == user.id).order_by(Place.created_at.desc())
        )
    ).scalars().all()
    return await _to_list_items(list(rows), db)


@router.get("/me/liked", response_model=list[PlaceListItem])
async def my_liked(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlaceListItem]:
    """Kullanıcının beğendiği yerler (Profil → Beğendiklerim)."""
    rows = (
        await db.execute(
            select(Place)
            .join(UserInteraction, UserInteraction.place_id == Place.id)
            .where(
                UserInteraction.user_id == user.id,
                UserInteraction.action_type == "like",
            )
            .order_by(UserInteraction.created_at.desc())
        )
    ).scalars().all()
    return await _to_list_items(list(rows), db, liked=True)


@router.get("/me/saved", response_model=list[PlaceListItem])
async def my_saved(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlaceListItem]:
    rows = (
        await db.execute(
            select(Place)
            .join(UserInteraction, UserInteraction.place_id == Place.id)
            .where(
                UserInteraction.user_id == user.id,
                UserInteraction.action_type == "save",
            )
            .order_by(UserInteraction.created_at.desc())
        )
    ).scalars().all()
    return await _to_list_items(list(rows), db)


@router.delete("/me")
async def delete_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Hesap silme (master prompt § 7.3).

    Kişisel veriler silinir; yüklenen yerler `created_by = NULL` ile anonim hale getirilir.
    """
    # Yer kayıtlarını anonimleştir (FK ON DELETE SET NULL ile zaten DB seviyesinde de
    # otomatiktir, ancak burada explicit yapıyoruz).
    await db.execute(
        Place.__table__.update().where(Place.created_by == user.id).values(created_by=None)
    )
    await db.delete(user)
    await db.commit()
    return {"message": "Hesabınız silindi. Yüklediğiniz yerler topluluk katkısı olarak kalmıştır."}

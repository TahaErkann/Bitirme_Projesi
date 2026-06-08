"""v1 ana router — alt modülleri birleştirir."""
from fastapi import APIRouter

from app.api.v1 import auth, discover, places, upload, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(places.router, prefix="/places", tags=["places"])
api_router.include_router(discover.router, prefix="/discover", tags=["discover"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

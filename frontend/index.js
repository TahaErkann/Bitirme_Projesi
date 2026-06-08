/**
 * TourLens — RN CLI giriş noktası.
 * react-native-gesture-handler en üstte import edilmelidir (Navigation 7 gerekliliği).
 */
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

const path = require('path');

const rncConfigAndroid = path
  .join(__dirname, 'node_modules', 'react-native-config', 'android')
  .replace(/\\/g, '/');

module.exports = {
  dependencies: {
    'react-native-config': {
      platforms: {
        android: {
          sourceDir: rncConfigAndroid,
          packageImportPath: 'import com.lugg.RNCConfig.RNCConfigPackage;',
          packageInstance: 'new RNCConfigPackage()',
          buildTypes: [],
          libraryName: 'RNCConfigSpec',
          componentDescriptors: [],
          cmakeListsPath:
            rncConfigAndroid +
            '/build/generated/source/codegen/jni/CMakeLists.txt',
        },
      },
    },
  },
};

module.exports = {
  extends: ['typescript', 'plugin:prettier/recommended', 'prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      {},
      {
        fileInfoOptions: {
          withNodeModules: true
        }
      }
    ],
    '@typescript-eslint/no-unused-vars': 'warn'
  },
  ignorePatterns: ['node_modules/', 'build/']
}

process.env.NODE_APP_PATH = __dirname
module.exports = {
  verbose: true,
  silent: true,
  // diabolico pq evita mostrar algunos logs cuando los analizo (en dev)
  forceExit: false,
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '__tests__', 'src/bin'],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.[t|j]sx?$': ['babel-jest', { rootMode: 'upward' }]
  }
}

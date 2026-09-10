// Static Compute config: no SDK dependency or deployment secrets required.
export default {
  region: 'eu-central-1',
  app: {
    name: 'volunteerops-backend',
    framework: 'custom',
    httpPort: 3001,
    build: {
      command: 'npm run compute:prepare',
      outputDirectory: '.prisma/compute-artifact',
      entrypoint: 'index.js',
    },
  },
};

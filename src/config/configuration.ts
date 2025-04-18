export default () => ({
  port: process.env.SERVER_PORT || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-default-secret', // ¡Cambiar en producción!
    expiresIn: process.env.JWT_EXPIRATION_TIME || '60m',
  },
  // Añadir más configuraciones según sea necesario
});

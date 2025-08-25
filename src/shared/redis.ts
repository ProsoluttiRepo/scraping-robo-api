import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost', // ou o host do container Redis
  port: Number(process.env.REDIS_PORT) || 6380,
  // password: 'senha', se necessário
});

export default redis;

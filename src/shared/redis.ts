import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST, // ou o host do container Redis
  port: Number(process.env.REDIS_PORT),
  // password: 'senha', se necessário
});

export default redis;

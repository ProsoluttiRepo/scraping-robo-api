import Redis from 'ioredis';

const redis = new Redis({
  host: 'redis', // ou o host do container Redis
  port: 6379,
  // password: 'senha', se necessário
});

export default redis;

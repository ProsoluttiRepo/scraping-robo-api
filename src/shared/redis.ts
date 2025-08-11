import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost', // ou o host do container Redis
  port: 6380,
  // password: 'senha', se necessário
});

export default redis;

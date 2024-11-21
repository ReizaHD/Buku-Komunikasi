import { Pool } from 'pg';
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:pTmhrCNj23It@ep-spring-unit-a71neguo-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
    ssl: {
        rejectUnauthorized: false,
    },
});

module.exports = pool;

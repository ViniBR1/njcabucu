// ============================================
// ===== NJ CABUÇU - SERVIDOR COMPLETO =====
// =========================================

require('dotenv').config();
console.log('🚀 Iniciando NJ Cabuçu...');

const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// ============================================
// ===== CONEXÃO NEON =====
// ============================================
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada!');
    process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
console.log('✅ Conectado ao Neon Database');

// ============================================
// ===== MERCADO PAGO =====
// ============================================
let PaymentService = null;
try {
    if (process.env.MP_ACCESS_TOKEN) {
        const client = new MercadoPagoConfig({
            accessToken: process.env.MP_ACCESS_TOKEN,
            options: { timeout: 30000 }
        });
        PaymentService = new Payment(client);
        console.log('✅ Mercado Pago configurado');
        console.log('🔑 Access Token:', process.env.MP_ACCESS_TOKEN.substring(0, 20) + '...');
    }
} catch (error) {
    console.log('⚠️ Erro MP:', error.message);
}

// ============================================
// ===== APP =====
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

app.use(cors({
    origin: ['https://igrejanjcabucurj.vercel.app', 'http://localhost:3000', 'http://localhost:3001', '*'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// ============================================
// ===== MULTER =====
// ============================================
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'));
        }
    }
});

// ============================================
// ===== FUNÇÕES =====
// ============================================
const hashPassword = async (pwd) => await bcrypt.hash(pwd, 10);
const verifyPassword = async (pwd, hash) => await bcrypt.compare(pwd, hash);

const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
};

const pastorOnly = (req, res, next) => {
    if (req.user?.role !== 'pastor') {
        return res.status(403).json({ error: 'Apenas o pastor' });
    }
    next();
};

// ============================================
// ===== INICIALIZAR BANCO =====
// ============================================
async function initDB() {
    console.log('📝 Criando tabelas...');
    
    try {
        // USERS
        await sql`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'colaborador',
            department_id INTEGER,
            department_name VARCHAR(100),
            first_login BOOLEAN DEFAULT true,
            phone VARCHAR(20),
            is_leader BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // DEPARTMENTS
        await sql`CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            leader_id INTEGER,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // DEPARTMENT MEMBERS
        await sql`CREATE TABLE IF NOT EXISTS department_members (
            department_id INTEGER,
            user_id INTEGER,
            role VARCHAR(50) DEFAULT 'membro',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (department_id, user_id)
        )`;

        // STUDIES
        await sql`CREATE TABLE IF NOT EXISTS studies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_url VARCHAR(500),
            image_url VARCHAR(500),
            image_base64 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // PRODUCTS
        await sql`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            image_url VARCHAR(500),
            image_base64 TEXT,
            stock INTEGER DEFAULT 0,
            category VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // EVENTS
        await sql`CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            date TIMESTAMP NOT NULL,
            image_url VARCHAR(500),
            image_base64 TEXT,
            price DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // PRAYERS
        await sql`CREATE TABLE IF NOT EXISTS prayers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            request TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // ORDERS (VENDAS)
        await sql`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(100),
            user_email VARCHAR(100),
            user_phone VARCHAR(20),
            items TEXT,
            total DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            payment_id VARCHAR(100),
            payment_method VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // REGISTRATIONS
        await sql`CREATE TABLE IF NOT EXISTS registrations (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            department_name VARCHAR(100),
            event_name VARCHAR(200),
            details TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            amount DECIMAL(10,2) DEFAULT 0,
            is_paid BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // WORSHIP SCALES
        await sql`CREATE TABLE IF NOT EXISTS worship_scales (
            id SERIAL PRIMARY KEY,
            department_id INTEGER,
            event_date TIMESTAMP NOT NULL,
            leader_id INTEGER,
            minister_id INTEGER,
            songs TEXT[],
            song_ids TEXT,
            musician_ids TEXT,
            palette TEXT,
            rehearsal BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // DONATIONS
        await sql`CREATE TABLE IF NOT EXISTS donations (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(100),
            user_email VARCHAR(100),
            user_phone VARCHAR(20),
            type VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_id VARCHAR(100),
            payment_method VARCHAR(50),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // CAROUSEL
        await sql`CREATE TABLE IF NOT EXISTS carousel_images (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200),
            subtitle VARCHAR(200),
            image_url VARCHAR(500),
            image_base64 TEXT,
            link VARCHAR(500),
            order_position INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // SITE SETTINGS
        await sql`CREATE TABLE IF NOT EXISTS site_settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // ===== TABELAS DE MEMBROS E SECRETARIA =====
        await sql`CREATE TABLE IF NOT EXISTS members (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            birth_date DATE,
            marital_status VARCHAR(20) DEFAULT 'solteiro',
            spouse_name VARCHAR(100),
            children TEXT,
            baptism_date DATE,
            baptism_place VARCHAR(100),
            address TEXT,
            department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            department_name VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
            event_date DATE NOT NULL,
            service_type VARCHAR(50) DEFAULT 'domingo',
            present BOOLEAN DEFAULT false,
            check_in_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(member_id, event_date, service_type)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS tithes (
            id SERIAL PRIMARY KEY,
            member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
            member_name VARCHAR(100),
            type VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(20) DEFAULT 'dinheiro',
            payment_date DATE DEFAULT CURRENT_DATE,
            description TEXT,
            received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description VARCHAR(200) NOT NULL,
            category VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            due_date DATE NOT NULL,
            paid BOOLEAN DEFAULT false,
            payment_date DATE,
            payment_method VARCHAR(20),
            notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS birthdays (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            birth_date DATE NOT NULL,
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS weddings (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            spouse_name VARCHAR(100) NOT NULL,
            wedding_date DATE NOT NULL,
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS baptism_dates (
            id SERIAL PRIMARY KEY,
            date TIMESTAMP NOT NULL,
            title VARCHAR(200) DEFAULT 'Batismo',
            description TEXT,
            max_participants INTEGER DEFAULT 20,
            current_participants INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // ===== TABELAS PARA DEPARTAMENTOS =====
        await sql`CREATE TABLE IF NOT EXISTS songs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            artist VARCHAR(100),
            key VARCHAR(10) DEFAULT 'C',
            lyrics TEXT,
            department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS availability (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            date TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date)
        )`;

        // ============================================
        // ===== TABELAS DE CÉLULAS =====
        // ============================================
        await sql`CREATE TABLE IF NOT EXISTS celulas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            lider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            endereco TEXT,
            dias_reuniao VARCHAR(100),
            horario VARCHAR(50),
            descricao TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_membros (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            membro_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
            data_entrada DATE DEFAULT CURRENT_DATE,
            is_active BOOLEAN DEFAULT true,
            UNIQUE(celula_id, membro_id)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_estatisticas (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            data_registro DATE DEFAULT CURRENT_DATE,
            total_membros INTEGER DEFAULT 0,
            batizados INTEGER DEFAULT 0,
            aceitaram_jesus INTEGER DEFAULT 0,
            visitantes INTEGER DEFAULT 0,
            novo_membros INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(celula_id, data_registro)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_decisoes (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            membro_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
            tipo VARCHAR(20) NOT NULL,
            data_decisao DATE DEFAULT CURRENT_DATE,
            observacao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        console.log('✅ Tabelas criadas');

        const existing = await sql`SELECT * FROM users WHERE email = 'pastor@njcabucu.com'`;
        if (existing.length === 0) {
            const hash = await hashPassword('admin123');
            await sql`
                INSERT INTO users (name, email, password_hash, role, department_name, first_login, is_leader)
                VALUES ('Pastor', 'pastor@njcabucu.com', ${hash}, 'pastor', 'Administração', false, true)
            `;
            console.log('✅ Pastor criado: pastor@njcabucu.com / admin123');
        }

        console.log('🎉 Sistema pronto!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

initDB();

// ============================================
// ===== ROTAS =====
// ============================================

// ----- LOGIN -----
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
        
        const user = users[0];
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department_id: user.department_id,
                department_name: user.department_name,
                first_login: user.first_login || false,
                phone: user.phone || '',
                is_leader: user.is_leader || false
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/change-password', async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const user = users[0];
        if (!user.first_login && currentPassword) {
            const valid = await verifyPassword(currentPassword, user.password_hash);
            if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const hash = await hashPassword(newPassword);
        await sql`UPDATE users SET password_hash = ${hash}, first_login = false WHERE id = ${user.id}`;
        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- USUÁRIOS E COLABORADORES -----
app.post('/api/users', auth, pastorOnly, async (req, res) => {
    try {
        const { name, email, password, role, department_name, phone, is_leader, department_id } = req.body;
        
        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }

        const hash = await hashPassword(password || '123456');
        
        let deptId = department_id || null;
        let deptName = department_name || null;
        
        if (deptId) {
            const dept = await sql`SELECT name FROM departments WHERE id = ${deptId}`;
            if (dept.length > 0) {
                deptName = dept[0].name;
            }
        }

        const result = await sql`
            INSERT INTO users (name, email, password_hash, role, department_id, department_name, phone, first_login, is_leader)
            VALUES (${name}, ${email}, ${hash}, ${role || 'colaborador'}, ${deptId}, ${deptName}, ${phone || ''}, true, ${is_leader || false})
            RETURNING id, name, email, role, department_id, department_name, is_leader
        `;
        
        if (deptId) {
            const memberRole = is_leader ? 'lider' : 'membro';
            await sql`
                INSERT INTO department_members (department_id, user_id, role)
                VALUES (${deptId}, ${result[0].id}, ${memberRole})
                ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${memberRole}
            `;
            
            if (is_leader) {
                await sql`
                    UPDATE departments SET leader_id = ${result[0].id} WHERE id = ${deptId}
                `;
            }
        }
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', auth, async (req, res) => {
    try {
        let users;
        if (req.user.role === 'pastor') {
            users = await sql`
                SELECT id, name, email, role, department_id, department_name, phone, first_login, is_leader, created_at
                FROM users ORDER BY name
            `;
        } else {
            const deptId = req.user.department_id;
            if (!deptId) return res.json([]);
            users = await sql`
                SELECT id, name, email, role, department_id, department_name, phone, first_login, is_leader, created_at
                FROM users WHERE department_id = ${deptId}
                ORDER BY name
            `;
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM users WHERE id = ${req.params.id}`;
        res.json({ message: 'Usuário removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reset-password', auth, pastorOnly, async (req, res) => {
    try {
        const { email } = req.body;
        const hash = await hashPassword('123456');
        await sql`UPDATE users SET password_hash = ${hash}, first_login = true WHERE email = ${email}`;
        res.json({ message: 'Senha resetada para 123456' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- DEPARTAMENTOS -----
app.post('/api/departments', auth, pastorOnly, async (req, res) => {
    try {
        const { name, description } = req.body;
        const result = await sql`
            INSERT INTO departments (name, description, created_by)
            VALUES (${name}, ${description || ''}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments', auth, async (req, res) => {
    try {
        const depts = await sql`
            SELECT d.*, u.name as leader_name
            FROM departments d
            LEFT JOIN users u ON d.leader_id = u.id
            WHERE d.is_active = true
            ORDER BY d.name
        `;
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments/active', async (req, res) => {
    try {
        const depts = await sql`
            SELECT id, name, description, leader_id
            FROM departments 
            WHERE is_active = true 
            ORDER BY name
        `;
        res.json(depts);
    } catch (error) {
        console.error('❌ Erro ao buscar departamentos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`UPDATE departments SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Departamento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- ESTUDOS -----
app.post('/api/studies', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, file_url } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO studies (title, description, file_url, image_base64)
            VALUES (${title}, ${description}, ${file_url}, ${image_base64})
            RETURNING *
        `;
        console.log('✅ Estudo criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar estudo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/studies', async (req, res) => {
    try {
        const studies = await sql`SELECT * FROM studies ORDER BY created_at DESC`;
        res.json(studies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/studies/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM studies WHERE id = ${req.params.id}`;
        res.json({ message: 'Estudo removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- PRODUTOS -----
app.post('/api/products', auth, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO products (name, description, price, image_base64, stock, category)
            VALUES (${name}, ${description}, ${parseFloat(price)}, ${image_base64}, ${parseInt(stock) || 0}, ${category || ''})
            RETURNING *
        `;
        console.log('✅ Produto criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await sql`SELECT * FROM products ORDER BY name`;
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM products WHERE id = ${req.params.id}`;
        res.json({ message: 'Produto removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- EVENTOS -----
app.post('/api/events', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, date, price } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO events (title, description, date, image_base64, price)
            VALUES (${title}, ${description}, ${date || new Date()}, ${image_base64}, ${parseFloat(price) || 0})
            RETURNING *
        `;
        console.log('✅ Evento criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const events = await sql`SELECT * FROM events ORDER BY date DESC`;
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/events/active', async (req, res) => {
    try {
        const events = await sql`
            SELECT id, title, description, date, price, image_base64
            FROM events 
            WHERE date >= NOW() 
            ORDER BY date ASC
        `;
        res.json(events);
    } catch (error) {
        console.error('❌ Erro ao buscar eventos ativos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/events/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM events WHERE id = ${req.params.id}`;
        res.json({ message: 'Evento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- ORAÇÕES -----
app.post('/api/prayers', async (req, res) => {
    try {
        const { name, request } = req.body;
        const result = await sql`
            INSERT INTO prayers (name, request)
            VALUES (${name || 'Anônimo'}, ${request})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/prayers', auth, async (req, res) => {
    try {
        const prayers = await sql`SELECT * FROM prayers ORDER BY created_at DESC`;
        res.json(prayers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/prayers/:id/read', auth, async (req, res) => {
    try {
        await sql`UPDATE prayers SET is_read = TRUE WHERE id = ${req.params.id}`;
        res.json({ message: 'Marcado como lido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- PEDIDOS (VENDAS) -----
app.post('/api/orders', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, items, total, payment_id, payment_method, status } = req.body;
        const result = await sql`
            INSERT INTO orders (user_name, user_email, user_phone, items, total, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${JSON.stringify(items)}, ${total}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        console.log('✅ Pedido criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', auth, async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        console.log('📦 Total de vendas:', orders.length);
        res.json(orders);
    } catch (error) {
        console.error('❌ Erro ao buscar vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales-stats', auth, pastorOnly, async (req, res) => {
    try {
        const totalSales = await sql`
            SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM orders
        `;
        
        const salesByDay = await sql`
            SELECT 
                DATE(created_at) as date, 
                COUNT(*) as count, 
                COALESCE(SUM(total), 0) as total 
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;
        
        const result = {
            total: totalSales[0] || { count: 0, total: 0 },
            byDay: salesByDay || []
        };
        
        res.json(result);
    } catch (error) {
        console.error('❌ Erro nas estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- INSCRIÇÕES -----
app.post('/api/registrations', async (req, res) => {
    try {
        const { type, name, email, phone, department_name, event_name, details, amount, is_paid, birth_date, baptism_date, baptism_date_id } = req.body;
        
        let finalDetails = details || '';
        
        if (type === 'baptism' && birth_date) {
            finalDetails = `Data de Nascimento: ${new Date(birth_date).toLocaleDateString('pt-BR')}\n`;
            if (baptism_date) {
                finalDetails += `Data do Batismo: ${new Date(baptism_date).toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}\n`;
            }
            finalDetails += details || '';
            
            if (baptism_date_id) {
                await sql`
                    UPDATE baptism_dates 
                    SET current_participants = current_participants + 1 
                    WHERE id = ${baptism_date_id}
                `;
            }
        }

        const result = await sql`
            INSERT INTO registrations (type, name, email, phone, department_name, event_name, details, amount, is_paid)
            VALUES (${type}, ${name}, ${email || ''}, ${phone || ''}, ${department_name || ''}, ${event_name || ''}, ${finalDetails || ''}, ${parseFloat(amount) || 0}, ${is_paid || false})
            RETURNING *
        `;
        console.log('✅ Inscrição criada:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro inscrição:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/registrations', auth, async (req, res) => {
    try {
        const registrations = await sql`SELECT * FROM registrations ORDER BY created_at DESC`;
        res.json(registrations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/registrations/:id/approve', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`UPDATE registrations SET status = 'approved' WHERE id = ${id}`;
        res.json({ message: 'Inscrição aprovada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/registrations/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM registrations WHERE id = ${req.params.id}`;
        res.json({ message: 'Inscrição removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- DOAÇÕES -----
app.post('/api/donations', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, type, amount, payment_id, payment_method, status } = req.body;
        const result = await sql`
            INSERT INTO donations (user_name, user_email, user_phone, type, amount, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${type}, ${amount}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/donations', auth, async (req, res) => {
    try {
        const donations = await sql`SELECT * FROM donations ORDER BY created_at DESC`;
        res.json(donations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ANIVERSARIANTES =====
// ============================================

app.get('/api/birthdays', async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        
        const birthdayMembers = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                department_name,
                'member' as source
            FROM members 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            ORDER BY EXTRACT(DAY FROM birth_date)
        `;
        
        const birthdayLegacy = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                NULL as department_name,
                'legacy' as source
            FROM birthdays 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            ORDER BY EXTRACT(DAY FROM birth_date)
        `;
        
        const allBirthdays = [...birthdayMembers, ...birthdayLegacy];
        const uniqueBirthdays = [];
        const names = new Set();
        
        allBirthdays.forEach(b => {
            if (!names.has(b.name)) {
                names.add(b.name);
                uniqueBirthdays.push(b);
            }
        });
        
        console.log(`🎂 Aniversariantes do mês ${currentMonth}:`, uniqueBirthdays.length);
        res.json(uniqueBirthdays);
    } catch (error) {
        console.error('❌ Erro ao buscar aniversariantes:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/birthdays/today', async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        
        const birthdayMembers = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                department_name
            FROM members 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            AND EXTRACT(DAY FROM birth_date) = ${currentDay}
            ORDER BY name
        `;
        
        res.json(birthdayMembers);
    } catch (error) {
        console.error('❌ Erro ao buscar aniversariantes do dia:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- CASAMENTOS -----
app.get('/api/weddings', async (req, res) => {
    try {
        const today = new Date();
        const weddings = await sql`
            SELECT * FROM weddings 
            WHERE is_active = true 
            ORDER BY 
                EXTRACT(MONTH FROM wedding_date) = ${today.getMonth() + 1} DESC,
                EXTRACT(DAY FROM wedding_date) = ${today.getDate()} DESC,
                EXTRACT(MONTH FROM wedding_date),
                EXTRACT(DAY FROM wedding_date)
            LIMIT 50
        `;
        res.json(weddings);
    } catch (error) {
        console.error('❌ Erro ao buscar casamentos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/weddings', auth, pastorOnly, async (req, res) => {
    try {
        const { name, spouse_name, wedding_date, phone } = req.body;
        const result = await sql`
            INSERT INTO weddings (name, spouse_name, wedding_date, phone)
            VALUES (${name}, ${spouse_name}, ${wedding_date}, ${phone || ''})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar casamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- BATISMO DATAS -----
app.get('/api/baptism-dates', async (req, res) => {
    try {
        const dates = await sql`
            SELECT id, date, title, description, max_participants, current_participants, is_active
            FROM baptism_dates 
            WHERE is_active = true
            ORDER BY date ASC
        `;
        res.json(dates);
    } catch (error) {
        console.error('❌ Erro ao buscar datas de batismo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/baptism-dates', auth, pastorOnly, async (req, res) => {
    try {
        const { date, title, description, max_participants } = req.body;
        const result = await sql`
            INSERT INTO baptism_dates (date, title, description, max_participants, created_by)
            VALUES (${date}, ${title || 'Batismo'}, ${description || ''}, ${max_participants || 20}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar data de batismo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/baptism-dates/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`UPDATE baptism_dates SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Data de batismo removida' });
    } catch (error) {
        console.error('❌ Erro ao remover data de batismo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== MÚSICAS =====
// ============================================

app.post('/api/songs', auth, async (req, res) => {
    try {
        const { title, artist, key, lyrics, department_id } = req.body;
        
        const deptId = department_id || req.user.department_id;
        if (!deptId) {
            return res.status(400).json({ error: 'Departamento não encontrado' });
        }
        
        const result = await sql`
            INSERT INTO songs (title, artist, key, lyrics, department_id, created_by)
            VALUES (${title}, ${artist || ''}, ${key || 'C'}, ${lyrics}, ${deptId}, ${req.user.id})
            RETURNING *
        `;
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar música:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/songs', auth, async (req, res) => {
    try {
        const { department_id } = req.query;
        let songs;
        
        if (department_id) {
            songs = await sql`
                SELECT * FROM songs 
                WHERE department_id = ${department_id}
                ORDER BY title
            `;
        } else if (req.user.department_id) {
            songs = await sql`
                SELECT * FROM songs 
                WHERE department_id = ${req.user.department_id}
                ORDER BY title
            `;
        } else {
            songs = await sql`
                SELECT * FROM songs 
                ORDER BY title
            `;
        }
        
        res.json(songs || []);
    } catch (error) {
        console.error('❌ Erro ao buscar músicas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/songs/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const song = await sql`SELECT * FROM songs WHERE id = ${id}`;
        if (song.length === 0) {
            return res.status(404).json({ error: 'Música não encontrada' });
        }
        
        await sql`DELETE FROM songs WHERE id = ${id}`;
        res.json({ message: 'Música removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover música:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- DISPONIBILIDADE -----
app.post('/api/availability', auth, async (req, res) => {
    try {
        const { user_id, date } = req.body;
        const result = await sql`
            INSERT INTO availability (user_id, date)
            VALUES (${user_id || req.user.id}, ${date})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao adicionar disponibilidade:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/availability/:user_id', auth, async (req, res) => {
    try {
        const { user_id } = req.params;
        const availability = await sql`
            SELECT * FROM availability 
            WHERE user_id = ${user_id} 
            ORDER BY date ASC
        `;
        res.json(availability);
    } catch (error) {
        console.error('❌ Erro ao buscar disponibilidade:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/availability/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM availability WHERE id = ${req.params.id}`;
        res.json({ message: 'Disponibilidade removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== WORSHIP SCALES =====
// ============================================

app.post('/api/worship-scales', auth, async (req, res) => {
    try {
        const { department_id, event_date, leader_id, minister_id, songs, song_ids, palette, rehearsal, musicians } = req.body;
        
        const user = await sql`
            SELECT * FROM users 
            WHERE id = ${req.user.id} 
            AND (is_leader = true OR role = 'lider' OR role = 'pastor')
        `;
        
        if (user.length === 0 && req.user.role !== 'pastor') {
            return res.status(403).json({ error: 'Apenas líderes podem criar escalas' });
        }
        
        const deptId = department_id || user[0]?.department_id;
        if (!deptId) {
            return res.status(400).json({ error: 'Departamento não encontrado' });
        }
        
        const songsArray = songs || [];
        const songIdsArray = song_ids || [];
        const musiciansArray = musicians || [];
        
        const result = await sql`
            INSERT INTO worship_scales (
                department_id, 
                event_date, 
                leader_id, 
                minister_id, 
                songs, 
                song_ids, 
                palette, 
                rehearsal, 
                musician_ids
            ) VALUES (
                ${deptId}, 
                ${event_date}, 
                ${leader_id || req.user.id}, 
                ${minister_id || null}, 
                ${songsArray}, 
                ${JSON.stringify(songIdsArray)}, 
                ${palette || 'Azul, Prata, Branco, Dourado'}, 
                ${rehearsal || false}, 
                ${JSON.stringify(musiciansArray)}
            ) RETURNING *
        `;
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar escala:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/worship-scales', auth, async (req, res) => {
    try {
        const scales = await sql`
            SELECT 
                ws.*, 
                d.name as department_name, 
                u.name as leader_name,
                m.name as minister_name
            FROM worship_scales ws
            LEFT JOIN departments d ON ws.department_id = d.id
            LEFT JOIN users u ON ws.leader_id = u.id
            LEFT JOIN users m ON ws.minister_id = m.id
            ORDER BY ws.event_date DESC
        `;
        
        res.json(scales || []);
    } catch (error) {
        console.error('❌ Erro ao buscar escalas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/worship-scales/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const scale = await sql`SELECT * FROM worship_scales WHERE id = ${id}`;
        if (scale.length === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }
        
        if (req.user.role !== 'pastor' && req.user.role !== 'lider' && !req.user.is_leader) {
            return res.status(403).json({ error: 'Você não tem permissão para remover esta escala' });
        }
        
        await sql`DELETE FROM worship_scales WHERE id = ${id}`;
        res.json({ message: 'Escala removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover escala:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- CARROSSEL -----
app.post('/api/carousel', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, link } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const image_base64 = req.file.buffer.toString('base64');

        const result = await sql`
            INSERT INTO carousel_images (title, subtitle, image_base64, link, order_position)
            VALUES (${title || ''}, ${subtitle || ''}, ${image_base64}, ${link || ''}, 
                (SELECT COALESCE(MAX(order_position), 0) + 1 FROM carousel_images))
            RETURNING *
        `;
        console.log('✅ Carrossel criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/carousel', async (req, res) => {
    try {
        const images = await sql`
            SELECT * FROM carousel_images WHERE active = true ORDER BY order_position, created_at
        `;
        console.log('🖼️ Carrossel imagens:', images.length);
        res.json(images);
    } catch (error) {
        console.error('❌ Erro carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/carousel/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM carousel_images WHERE id = ${req.params.id}`;
        res.json({ message: 'Imagem removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- CONFIGURAÇÕES -----
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await sql`SELECT * FROM site_settings`;
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', auth, pastorOnly, async (req, res) => {
    try {
        const { key, value } = req.body;
        await sql`
            INSERT INTO site_settings (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = ${value}
        `;
        res.json({ message: 'Configuração atualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== MEMBROS =====
// ============================================

app.post('/api/members', auth, async (req, res) => {
    try {
        const { 
            name, email, phone, birth_date, marital_status, spouse_name, 
            children, baptism_date, baptism_place, address, 
            department_id, department_name, notes 
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await sql`
            INSERT INTO members (
                name, email, phone, birth_date, marital_status, spouse_name,
                children, baptism_date, baptism_place, address,
                department_id, department_name, notes, created_by
            ) VALUES (
                ${name}, ${email}, ${phone}, ${birth_date}, ${marital_status}, ${spouse_name},
                ${children}, ${baptism_date}, ${baptism_place}, ${address},
                ${department_id}, ${department_name}, ${notes}, ${req.user.id}
            ) RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/members', auth, async (req, res) => {
    try {
        const { department_id, search } = req.query;
        
        let members;
        
        if (department_id && search) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND department_id = ${department_id}
                AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'} OR phone ILIKE ${'%' + search + '%'})
                ORDER BY name
            `;
        } else if (department_id) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND department_id = ${department_id}
                ORDER BY name
            `;
        } else if (search) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'} OR phone ILIKE ${'%' + search + '%'})
                ORDER BY name
            `;
        } else {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                ORDER BY name
            `;
        }

        res.json(members);
    } catch (error) {
        console.error('❌ Erro ao listar membros:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const member = await sql`SELECT * FROM members WHERE id = ${id}`;
        
        if (member.length === 0) {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }

        const attendance = await sql`
            SELECT * FROM attendance 
            WHERE member_id = ${id} 
            ORDER BY event_date DESC 
            LIMIT 10
        `;

        res.json({
            ...member[0],
            attendance: attendance
        });
    } catch (error) {
        console.error('❌ Erro ao buscar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, email, phone, birth_date, marital_status, spouse_name,
            children, baptism_date, baptism_place, address,
            department_id, department_name, notes, is_active
        } = req.body;

        const result = await sql`
            UPDATE members SET 
                name = COALESCE(${name}, name),
                email = COALESCE(${email}, email),
                phone = COALESCE(${phone}, phone),
                birth_date = COALESCE(${birth_date}, birth_date),
                marital_status = COALESCE(${marital_status}, marital_status),
                spouse_name = COALESCE(${spouse_name}, spouse_name),
                children = COALESCE(${children}, children),
                baptism_date = COALESCE(${baptism_date}, baptism_date),
                baptism_place = COALESCE(${baptism_place}, baptism_place),
                address = COALESCE(${address}, address),
                department_id = COALESCE(${department_id}, department_id),
                department_name = COALESCE(${department_name}, department_name),
                notes = COALESCE(${notes}, notes),
                is_active = COALESCE(${is_active}, is_active)
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao atualizar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`UPDATE members SET is_active = false WHERE id = ${id}`;
        res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== FREQUÊNCIA =====
// ============================================

app.post('/api/attendance', auth, async (req, res) => {
    try {
        const { member_id, event_date, service_type, present } = req.body;

        if (!member_id || !event_date) {
            return res.status(400).json({ error: 'Membro e data são obrigatórios' });
        }

        const result = await sql`
            INSERT INTO attendance (member_id, event_date, service_type, present, check_in_time)
            VALUES (${member_id}, ${event_date}, ${service_type || 'domingo'}, ${present || false}, ${present ? new Date() : null})
            ON CONFLICT (member_id, event_date, service_type) 
            DO UPDATE SET present = ${present || false}, check_in_time = ${present ? new Date() : null}
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar frequência:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/:member_id', auth, async (req, res) => {
    try {
        const { member_id } = req.params;
        const { limit = 10 } = req.query;

        const result = await sql`
            SELECT * FROM attendance 
            WHERE member_id = ${member_id} 
            ORDER BY event_date DESC 
            LIMIT ${limit}
        `;

        res.json(result);
    } catch (error) {
        console.error('❌ Erro ao buscar frequência:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/stats/:member_id', auth, async (req, res) => {
    try {
        const { member_id } = req.params;

        const result = await sql`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN present = true THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN present = false THEN 1 ELSE 0 END) as absent,
                ROUND((SUM(CASE WHEN present = true THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100), 2) as percentage
            FROM attendance 
            WHERE member_id = ${member_id}
        `;

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/date/:date', auth, async (req, res) => {
    try {
        const { date } = req.params;
        
        const records = await sql`
            SELECT a.*, m.name as member_name
            FROM attendance a
            LEFT JOIN members m ON a.member_id = m.id
            WHERE a.event_date = ${date}
            ORDER BY a.created_at DESC
        `;
        
        res.json(records);
    } catch (error) {
        console.error('❌ Erro ao buscar frequência por data:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== DÍZIMOS E OFERTAS =====
// ============================================

app.post('/api/tithes', auth, async (req, res) => {
    try {
        const { member_id, member_name, type, amount, payment_method, payment_date, description } = req.body;

        if (!type || !amount) {
            return res.status(400).json({ error: 'Tipo e valor são obrigatórios' });
        }

        const result = await sql`
            INSERT INTO tithes (member_id, member_name, type, amount, payment_method, payment_date, description, received_by)
            VALUES (${member_id || null}, ${member_name || ''}, ${type}, ${amount}, ${payment_method || 'dinheiro'}, ${payment_date || new Date()}, ${description || ''}, ${req.user.id})
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar dízimo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes', auth, async (req, res) => {
    try {
        const { type, start_date, end_date, member_id } = req.query;
        
        let tithes;
        
        if (type && member_id) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE type = ${type} AND member_id = ${member_id}
                ORDER BY payment_date DESC
            `;
        } else if (type) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE type = ${type}
                ORDER BY payment_date DESC
            `;
        } else if (member_id) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE member_id = ${member_id}
                ORDER BY payment_date DESC
            `;
        } else {
            tithes = await sql`
                SELECT * FROM tithes 
                ORDER BY payment_date DESC
            `;
        }

        res.json(tithes);
    } catch (error) {
        console.error('❌ Erro ao listar dízimos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes/summary', auth, async (req, res) => {
    try {
        const result = await sql`
            SELECT 
                type,
                COUNT(*) as count,
                SUM(amount) as total
            FROM tithes
            GROUP BY type
            ORDER BY type
        `;

        const total = result.reduce((sum, r) => sum + parseFloat(r.total), 0);

        res.json({
            by_type: result,
            total: total
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== CONTAS A PAGAR =====
// ============================================

app.post('/api/bills', auth, async (req, res) => {
    try {
        const { description, category, amount, due_date, notes } = req.body;

        if (!description || !category || !amount || !due_date) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
        }

        const result = await sql`
            INSERT INTO bills (description, category, amount, due_date, notes, created_by)
            VALUES (${description}, ${category}, ${amount}, ${due_date}, ${notes || ''}, ${req.user.id})
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bills', auth, async (req, res) => {
    try {
        const { paid, category } = req.query;
        
        let bills;
        
        if (paid !== undefined && category) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE paid = ${paid === 'true'} AND category = ${category}
                ORDER BY due_date ASC, paid ASC
            `;
        } else if (paid !== undefined) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE paid = ${paid === 'true'}
                ORDER BY due_date ASC, paid ASC
            `;
        } else if (category) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE category = ${category}
                ORDER BY due_date ASC, paid ASC
            `;
        } else {
            bills = await sql`
                SELECT * FROM bills 
                ORDER BY due_date ASC, paid ASC
            `;
        }

        res.json(bills);
    } catch (error) {
        console.error('❌ Erro ao listar contas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/bills/:id/pay', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_date, payment_method } = req.body;

        const result = await sql`
            UPDATE bills SET 
                paid = true,
                payment_date = ${payment_date || new Date()},
                payment_method = ${payment_method || 'dinheiro'}
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao pagar conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/bills/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`DELETE FROM bills WHERE id = ${id}`;
        res.json({ message: 'Conta removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bills/summary', auth, async (req, res) => {
    try {
        const summary = await sql`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN paid = false THEN amount ELSE 0 END) as pending,
                SUM(CASE WHEN paid = true THEN amount ELSE 0 END) as paid_total,
                COUNT(CASE WHEN paid = false THEN 1 ELSE 0 END) as pending_count,
                COUNT(CASE WHEN paid = true THEN 1 ELSE 0 END) as paid_count
            FROM bills
        `;

        const categories = await sql`
            SELECT 
                category,
                COUNT(*) as count,
                SUM(CASE WHEN paid = false THEN amount ELSE 0 END) as pending,
                SUM(CASE WHEN paid = true THEN amount ELSE 0 END) as paid_total
            FROM bills
            GROUP BY category
            ORDER BY category
        `;

        res.json({
            summary: summary[0],
            by_category: categories
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== MERCADO PAGO - PIX =====
// ============================================

app.post('/api/create-pix-payment', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        const externalReference = `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'pix',
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: externalReference,
                notification_url: `${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}/api/webhook`
            }
        };

        console.log('📝 Criando pagamento PIX...');
        console.log('📝 Valor:', valor);
        console.log('📝 External Reference:', externalReference);
        console.log('📝 Email:', email);

        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);
        console.log('✅ Status:', payment.status);

        const paymentLink = payment.point_of_interaction?.transaction_data?.ticket_url || 
                           `https://www.mercadopago.com.br/payments/${payment.id}`;

        res.json({
            payment_id: payment.id,
            status: payment.status,
            payment_link: paymentLink,
            external_reference: externalReference,
            qr_code: payment.point_of_interaction?.transaction_data?.qr_code || '',
            qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || ''
        });
    } catch (error) {
        console.error('❌ Erro MP PIX:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

// ============================================
// ===== MERCADO PAGO - CARTÃO =====
// ============================================

app.post('/api/create-card-payment', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf, card_token, installments } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        if (!card_token) {
            return res.status(400).json({ error: 'Token do cartão é obrigatório' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'credit_card',
                installments: parseInt(installments) || 1,
                token: card_token,
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                notification_url: `${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}/api/webhook`
            }
        };

        console.log('📝 Criando pagamento com cartão...');
        console.log('📝 Valor:', valor);
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);
        console.log('✅ Status:', payment.status);

        res.json({
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro MP cartão:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

// ============================================
// ===== MERCADO PAGO - CARTÃO FALLBACK =====
// ============================================

app.post('/api/create-card-payment-fallback', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf, card_number, card_expiry, card_cvv, installments } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        if (!card_number || card_number.length < 16) {
            return res.status(400).json({ error: 'Número do cartão inválido' });
        }
        if (!card_expiry || !card_expiry.includes('/')) {
            return res.status(400).json({ error: 'Data de validade inválida' });
        }
        if (!card_cvv || card_cvv.length < 3) {
            return res.status(400).json({ error: 'CVV inválido' });
        }

        const tokenData = {
            card_number: card_number.replace(/\s/g, ''),
            expiration_month: parseInt(card_expiry.split('/')[0]),
            expiration_year: parseInt('20' + card_expiry.split('/')[1]),
            security_code: card_cvv,
            cardholder: {
                name: name || 'Cliente',
                identification: {
                    type: 'CPF',
                    number: cpf || '12345678909'
                }
            }
        };

        console.log('🔄 Criando token do cartão via API...');
        
        const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify(tokenData)
        });

        const tokenResult = await tokenResponse.json();
        
        if (tokenResult.error) {
            console.error('❌ Erro ao criar token:', tokenResult.error);
            const testToken = 'test_' + Date.now();
            return await processCardPayment(testToken, valor, description, email, name, phone, cpf, installments, res);
        }

        if (!tokenResult.id) {
            throw new Error('Não foi possível gerar o token do cartão');
        }

        console.log('✅ Token criado:', tokenResult.id);
        return await processCardPayment(tokenResult.id, valor, description, email, name, phone, cpf, installments, res);

    } catch (error) {
        console.error('❌ Erro MP cartão fallback:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

async function processCardPayment(token, valor, description, email, name, phone, cpf, installments, res) {
    try {
        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'credit_card',
                installments: parseInt(installments) || 1,
                token: token,
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                notification_url: `${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}/api/webhook`
            }
        };

        console.log('📝 Criando pagamento com cartão...');
        console.log('📝 Valor:', valor);
        
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);
        console.log('✅ Status:', payment.status);

        res.json({
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
}

// ============================================
// ===== VERIFICAR STATUS DO PAGAMENTO =====
// ============================================

app.get('/api/check-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        if (!PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }
        
        console.log('🔍 Verificando pagamento:', paymentId);
        const payment = await PaymentService.get({ id: paymentId });
        console.log('📊 Status:', payment.status);
        
        res.json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payment-status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        if (!PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }
        
        console.log('🔍 Verificando pagamento (rota alternativa):', paymentId);
        const payment = await PaymentService.get({ id: paymentId });
        console.log('📊 Status:', payment.status);
        
        res.json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-payment-status', async (req, res) => {
    try {
        const { payment_id, status } = req.body;
        
        await sql`
            UPDATE orders SET status = ${status} WHERE payment_id = ${payment_id}
        `;
        await sql`
            UPDATE donations SET status = ${status} WHERE payment_id = ${payment_id}
        `;
        
        console.log(`✅ Status do pagamento ${payment_id} atualizado para ${status}`);
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== WEBHOOK =====
// ============================================

app.post('/api/webhook', async (req, res) => {
    try {
        console.log('📝 Webhook recebido:', JSON.stringify(req.body, null, 2));
        
        const { data, type } = req.body;
        
        if (type === 'payment' && data && data.id) {
            const paymentId = data.id;
            console.log(`✅ Pagamento ${paymentId} confirmado!`);
            
            if (PaymentService) {
                try {
                    const payment = await PaymentService.get({ id: paymentId });
                    console.log('📊 Status do pagamento:', payment.status);
                    
                    if (payment.status === 'approved') {
                        await sql`
                            UPDATE orders SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        console.log('✅ Pagamento aprovado e registrado!');
                    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                        await sql`
                            UPDATE orders SET status = 'rejected' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'rejected' WHERE payment_id = ${paymentId}
                        `;
                        console.log('❌ Pagamento recusado/cancelado');
                    }
                } catch (error) {
                    console.error('❌ Erro ao buscar pagamento:', error);
                }
            }
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('❌ Erro webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== PDF DE CONFIRMAÇÃO =====
// ============================================

app.get('/api/registration-pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const registrations = await sql`SELECT * FROM registrations WHERE id = ${id}`;
        
        if (registrations.length === 0) {
            return res.status(404).json({ error: 'Inscrição não encontrada' });
        }
        
        const reg = registrations[0];
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Inscrição</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem; }
                .header { text-align: center; border-bottom: 3px solid #0D47A1; padding-bottom: 1rem; margin-bottom: 1.5rem; }
                .header h1 { color: #0D47A1; margin: 0; }
                .header p { color: #666; margin: 0; }
                .info { margin: 1rem 0; }
                .info-item { display: flex; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
                .info-item .label { font-weight: bold; width: 120px; }
                .info-item .value { flex: 1; }
                .status { display: inline-block; padding: 0.3rem 1rem; border-radius: 20px; font-weight: bold; }
                .status.pending { background: #fff3cd; color: #856404; }
                .status.confirmed { background: #d4edda; color: #155724; }
                .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #888; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🙏 NJ Cabuçu</h1>
                <p>Comprovante de Inscrição</p>
            </div>
            
            <div class="info">
                <div class="info-item">
                    <span class="label">Protocolo:</span>
                    <span class="value">#${String(reg.id).padStart(6, '0')}</span>
                </div>
                <div class="info-item">
                    <span class="label">Data:</span>
                    <span class="value">${new Date(reg.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                <div class="info-item">
                    <span class="label">Tipo:</span>
                    <span class="value">${reg.type === 'baptism' ? 'Batismo' : reg.type === 'volunteer' ? 'Voluntário' : reg.type === 'event' ? 'Evento' : 'Departamento'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Nome:</span>
                    <span class="value">${reg.name}</span>
                </div>
                <div class="info-item">
                    <span class="label">E-mail:</span>
                    <span class="value">${reg.email || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Telefone:</span>
                    <span class="value">${reg.phone || '-'}</span>
                </div>
                ${reg.event_name ? `<div class="info-item"><span class="label">Evento:</span><span class="value">${reg.event_name}</span></div>` : ''}
                ${reg.department_name ? `<div class="info-item"><span class="label">Departamento:</span><span class="value">${reg.department_name}</span></div>` : ''}
                ${reg.details ? `<div class="info-item"><span class="label">Detalhes:</span><span class="value">${reg.details}</span></div>` : ''}
                <div class="info-item">
                    <span class="label">Status:</span>
                    <span class="value"><span class="status ${reg.status === 'approved' ? 'confirmed' : 'pending'}">${reg.status === 'approved' ? '✅ Confirmado' : '⏳ Pendente'}</span></span>
                </div>
                ${reg.amount > 0 ? `<div class="info-item"><span class="label">Valor:</span><span class="value">R$ ${parseFloat(reg.amount).toFixed(2)}</span></div>` : ''}
                ${reg.is_paid ? `<div class="info-item"><span class="label">Pagamento:</span><span class="value">✅ Pago</span></div>` : ''}
            </div>
            
            <div class="footer">
                <p>NJ Cabuçu - "E conhecereis a verdade, e a verdade vos libertará." João 8:32</p>
                <p>© ${new Date().getFullYear()} NJ Cabuçu - Todos os direitos reservados</p>
            </div>
        </body>
        </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CÉLULAS =====
// ============================================

// ---- CRIAR CÉLULA ----
app.post('/api/celulas', auth, pastorOnly, async (req, res) => {
    try {
        const { nome, lider_id, endereco, dias_reuniao, horario, descricao } = req.body;
        
        if (!nome) {
            return res.status(400).json({ error: 'Nome da célula é obrigatório' });
        }

        const result = await sql`
            INSERT INTO celulas (nome, lider_id, endereco, dias_reuniao, horario, descricao, created_by)
            VALUES (${nome}, ${lider_id || null}, ${endereco || ''}, ${dias_reuniao || ''}, ${horario || ''}, ${descricao || ''}, ${req.user.id})
            RETURNING *
        `;
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar célula:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- LISTAR CÉLULAS ----
app.get('/api/celulas', async (req, res) => {
    try {
        const celulas = await sql`
            SELECT 
                c.*,
                u.name as lider_nome,
                COUNT(cm.id) as total_membros,
                (
                    SELECT COUNT(*) FROM celula_membros cm2 
                    WHERE cm2.celula_id = c.id AND cm2.is_active = true
                ) as membros_ativos,
                (
                    SELECT COUNT(*) FROM celula_decisoes cd 
                    WHERE cd.celula_id = c.id AND cd.tipo = 'batismo'
                ) as batizados,
                (
                    SELECT COUNT(*) FROM celula_decisoes cd 
                    WHERE cd.celula_id = c.id AND cd.tipo = 'decisao'
                ) as decisoes
            FROM celulas c
            LEFT JOIN users u ON c.lider_id = u.id
            LEFT JOIN celula_membros cm ON c.id = cm.celula_id AND cm.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, u.name
            ORDER BY c.nome
        `;
        
        res.json(celulas);
    } catch (error) {
        console.error('❌ Erro ao listar células:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- BUSCAR CÉLULA POR ID ----
app.get('/api/celulas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const celula = await sql`
            SELECT 
                c.*,
                u.name as lider_nome,
                u.phone as lider_telefone,
                u.email as lider_email
            FROM celulas c
            LEFT JOIN users u ON c.lider_id = u.id
            WHERE c.id = ${id} AND c.is_active = true
        `;
        
        if (celula.length === 0) {
            return res.status(404).json({ error: 'Célula não encontrada' });
        }
        
        // Buscar membros da célula
        const membros = await sql`
            SELECT 
                m.id,
                m.name,
                m.phone,
                m.email,
                cm.data_entrada
            FROM celula_membros cm
            JOIN members m ON cm.membro_id = m.id
            WHERE cm.celula_id = ${id} AND cm.is_active = true
            ORDER BY m.name
        `;
        
        // Buscar estatísticas
        const estatisticas = await sql`
            SELECT * FROM celula_estatisticas 
            WHERE celula_id = ${id} 
            ORDER BY data_registro DESC 
            LIMIT 10
        `;
        
        // Buscar decisões recentes
        const decisoes = await sql`
            SELECT 
                cd.*,
                m.name as membro_nome
            FROM celula_decisoes cd
            LEFT JOIN members m ON cd.membro_id = m.id
            WHERE cd.celula_id = ${id}
            ORDER BY cd.data_decisao DESC
            LIMIT 20
        `;
        
        res.json({
            ...celula[0],
            membros,
            estatisticas,
            decisoes
        });
    } catch (error) {
        console.error('❌ Erro ao buscar célula:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- ATUALIZAR CÉLULA ----
app.put('/api/celulas/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, lider_id, endereco, dias_reuniao, horario, descricao } = req.body;
        
        const result = await sql`
            UPDATE celulas 
            SET 
                nome = COALESCE(${nome}, nome),
                lider_id = COALESCE(${lider_id}, lider_id),
                endereco = COALESCE(${endereco}, endereco),
                dias_reuniao = COALESCE(${dias_reuniao}, dias_reuniao),
                horario = COALESCE(${horario}, horario),
                descricao = COALESCE(${descricao}, descricao)
            WHERE id = ${id}
            RETURNING *
        `;
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Célula não encontrada' });
        }
        
        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao atualizar célula:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- DELETAR CÉLULA ----
app.delete('/api/celulas/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`UPDATE celulas SET is_active = false WHERE id = ${id}`;
        res.json({ message: 'Célula removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover célula:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- ADICIONAR MEMBRO À CÉLULA ----
app.post('/api/celulas/:id/membros', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { membro_id } = req.body;
        
        if (!membro_id) {
            return res.status(400).json({ error: 'Membro é obrigatório' });
        }
        
        // Verifica se o membro já está na célula
        const exists = await sql`
            SELECT * FROM celula_membros 
            WHERE celula_id = ${id} AND membro_id = ${membro_id}
        `;
        
        if (exists.length > 0) {
            // Reativar se estiver inativo
            await sql`
                UPDATE celula_membros 
                SET is_active = true, data_entrada = CURRENT_DATE
                WHERE celula_id = ${id} AND membro_id = ${membro_id}
            `;
        } else {
            await sql`
                INSERT INTO celula_membros (celula_id, membro_id)
                VALUES (${id}, ${membro_id})
            `;
        }
        
        // Atualizar estatísticas
        await atualizarEstatisticasCelula(id);
        
        res.json({ message: 'Membro adicionado à célula com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao adicionar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- REMOVER MEMBRO DA CÉLULA ----
app.delete('/api/celulas/:id/membros/:membro_id', auth, async (req, res) => {
    try {
        const { id, membro_id } = req.params;
        
        await sql`
            UPDATE celula_membros 
            SET is_active = false 
            WHERE celula_id = ${id} AND membro_id = ${membro_id}
        `;
        
        await atualizarEstatisticasCelula(id);
        
        res.json({ message: 'Membro removido da célula' });
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- REGISTRAR DECISÃO (BATISMO OU ACEITOU JESUS) ----
app.post('/api/celulas/:id/decisoes', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { membro_id, tipo, observacao } = req.body;
        
        if (!tipo || !['batismo', 'decisao'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido. Use "batismo" ou "decisao"' });
        }
        
        const result = await sql`
            INSERT INTO celula_decisoes (celula_id, membro_id, tipo, observacao)
            VALUES (${id}, ${membro_id || null}, ${tipo}, ${observacao || ''})
            RETURNING *
        `;
        
        await atualizarEstatisticasCelula(id);
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar decisão:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---- FUNÇÃO PARA ATUALIZAR ESTATÍSTICAS ----
async function atualizarEstatisticasCelula(celula_id) {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        
        // Contar membros ativos
        const membros = await sql`
            SELECT COUNT(*) as total FROM celula_membros 
            WHERE celula_id = ${celula_id} AND is_active = true
        `;
        
        // Contar batizados nos últimos 30 dias
        const batizados = await sql`
            SELECT COUNT(*) as total FROM celula_decisoes 
            WHERE celula_id = ${celula_id} 
            AND tipo = 'batismo' 
            AND data_decisao >= CURRENT_DATE - INTERVAL '30 days'
        `;
        
        // Contar decisões (aceitaram Jesus) nos últimos 30 dias
        const decisoes = await sql`
            SELECT COUNT(*) as total FROM celula_decisoes 
            WHERE celula_id = ${celula_id} 
            AND tipo = 'decisao' 
            AND data_decisao >= CURRENT_DATE - INTERVAL '30 days'
        `;
        
        // Inserir ou atualizar estatísticas do dia
        await sql`
            INSERT INTO celula_estatisticas (celula_id, data_registro, total_membros, batizados, aceitaram_jesus)
            VALUES (${celula_id}, ${hoje}, ${membros[0].total}, ${batizados[0].total}, ${decisoes[0].total})
            ON CONFLICT (celula_id, data_registro) 
            DO UPDATE SET 
                total_membros = ${membros[0].total},
                batizados = ${batizados[0].total},
                aceitaram_jesus = ${decisoes[0].total}
        `;
        
        console.log(`📊 Estatísticas da célula ${celula_id} atualizadas`);
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
    }
}

// ---- ROTA PARA ESTATÍSTICAS DETALHADAS ----
app.get('/api/celulas/:id/estatisticas', async (req, res) => {
    try {
        const { id } = req.params;
        
        const estatisticas = await sql`
            SELECT * FROM celula_estatisticas 
            WHERE celula_id = ${id} 
            ORDER BY data_registro DESC 
            LIMIT 30
        `;
        
        const resumo = await sql`
            SELECT 
                SUM(total_membros) as total_membros,
                SUM(batizados) as total_batizados,
                SUM(aceitaram_jesus) as total_decisoes
            FROM celula_estatisticas 
            WHERE celula_id = ${id}
        `;
        
        res.json({
            historico: estatisticas,
            resumo: resumo[0] || { total_membros: 0, total_batizados: 0, total_decisoes: 0 }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== SERVE HTML =====
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/departamento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'departamento.html'));
});

// ============================================
// ===== INICIAR =====
// ============================================

app.listen(PORT, () => {
    console.log('');
    console.log('🔥 NJ Cabuçu rodando na porta ' + PORT);
    console.log('🌐 ' + BASE_URL);
    console.log('');
    console.log('📋 Credenciais:');
    console.log('   Email: pastor@njcabucu.com');
    console.log('   Senha: admin123');
    console.log('');
    console.log('💰 Mercado Pago: ' + (process.env.MP_ACCESS_TOKEN ? '✅ Configurado' : '⚠️ Não configurado'));
    console.log('🔑 Public Key: ' + (process.env.MP_PUBLIC_KEY ? '✅ Configurada' : '⚠️ Não configurada'));
    console.log('');
    console.log('📸 Imagens salvas como Base64 no banco de dados!');
    console.log('');
});

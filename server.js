// ============================================
// ===== NJ CABUÇU - SERVIDOR COMPLETO =====
// ============================================

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

// ===== CONEXÃO NEON =====
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada!');
    process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
console.log('✅ Conectado ao Neon Database');

// ===== MERCADO PAGO =====
let PaymentService = null;
try {
    if (process.env.MP_ACCESS_TOKEN) {
        const client = new MercadoPagoConfig({
            accessToken: process.env.MP_ACCESS_TOKEN,
            options: { timeout: 10000 }
        });
        PaymentService = new Payment(client);
        console.log('✅ Mercado Pago configurado');
    }
} catch (error) {
    console.log('⚠️ Erro MP:', error.message);
}

// ===== APP =====
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// ===== MULTER =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = './public/uploads/';
        if (req.path.includes('studies')) dir = './public/uploads/estudos/';
        else if (req.path.includes('products')) dir = './public/uploads/produtos/';
        else if (req.path.includes('events')) dir = './public/uploads/eventos/';
        else if (req.path.includes('carousel')) dir = './public/uploads/carousel/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
    }
});

// ===== FUNÇÕES =====
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
        await sql`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'fiel',
            department_id INTEGER,
            department_name VARCHAR(100),
            first_login BOOLEAN DEFAULT true,
            phone VARCHAR(20),
            is_leader BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            leader_id INTEGER,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS department_members (
            department_id INTEGER,
            user_id INTEGER,
            role VARCHAR(50) DEFAULT 'membro',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (department_id, user_id)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS studies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_url VARCHAR(500),
            image_url VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            image_url VARCHAR(500),
            stock INTEGER DEFAULT 0,
            category VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            date TIMESTAMP NOT NULL,
            image_url VARCHAR(500),
            price DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS prayers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            request TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

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

        await sql`CREATE TABLE IF NOT EXISTS worship_scales (
            id SERIAL PRIMARY KEY,
            department_id INTEGER,
            event_date TIMESTAMP NOT NULL,
            leader_id INTEGER,
            songs TEXT[],
            palette TEXT,
            rehearsal BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

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

        await sql`CREATE TABLE IF NOT EXISTS carousel_images (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200),
            subtitle VARCHAR(200),
            image_url VARCHAR(500) NOT NULL,
            link VARCHAR(500),
            order_position INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS site_settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

        const settings = await sql`SELECT * FROM site_settings WHERE key = 'primary_color'`;
        if (settings.length === 0) {
            await sql`
                INSERT INTO site_settings (key, value) VALUES 
                ('primary_color', '#0D47A1'),
                ('site_title', 'NJ Cabuçu'),
                ('whatsapp', '5521985345627')
            `;
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

// ----- USUÁRIOS -----
app.post('/api/users', auth, pastorOnly, async (req, res) => {
    try {
        const { name, email, password, role, department_name, phone } = req.body;
        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.length > 0) return res.status(400).json({ error: 'Usuário já existe' });

        const hash = await hashPassword(password || '123456');
        const result = await sql`
            INSERT INTO users (name, email, password_hash, role, department_name, phone, first_login)
            VALUES (${name}, ${email}, ${hash}, ${role || 'fiel'}, ${department_name || ''}, ${phone || ''}, true)
            RETURNING id, name, email, role
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', auth, async (req, res) => {
    try {
        const users = await sql`SELECT id, name, email, role, department_name, phone FROM users ORDER BY name`;
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
        const { name, leader_email, description } = req.body;
        let leader_id = null;
        if (leader_email) {
            const leader = await sql`SELECT id FROM users WHERE email = ${leader_email}`;
            if (leader.length > 0) leader_id = leader[0].id;
        }
        const result = await sql`
            INSERT INTO departments (name, leader_id, description)
            VALUES (${name}, ${leader_id}, ${description || ''})
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
            ORDER BY d.name
        `;
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/departments/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, leader_email, description } = req.body;
        let leader_id = null;
        if (leader_email) {
            const leader = await sql`SELECT id FROM users WHERE email = ${leader_email}`;
            if (leader.length > 0) leader_id = leader[0].id;
        }
        const result = await sql`
            UPDATE departments 
            SET name = ${name}, leader_id = ${leader_id}, description = ${description || ''}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM departments WHERE id = ${req.params.id}`;
        res.json({ message: 'Departamento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const members = await sql`
            SELECT u.id, u.name, u.email, dm.role
            FROM users u
            INNER JOIN department_members dm ON u.id = dm.user_id
            WHERE dm.department_id = ${req.params.id}
        `;
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const { user_id, role } = req.body;
        await sql`
            INSERT INTO department_members (department_id, user_id, role)
            VALUES (${req.params.id}, ${user_id}, ${role || 'membro'})
            ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${role || 'membro'}
        `;
        await sql`
            UPDATE users SET department_id = ${req.params.id}, is_leader = ${role === 'lider' ? true : false}
            WHERE id = ${user_id}
        `;
        res.json({ message: 'Membro adicionado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:department_id/members/:user_id', auth, async (req, res) => {
    try {
        await sql`
            DELETE FROM department_members WHERE department_id = ${req.params.department_id} AND user_id = ${req.params.user_id}
        `;
        await sql`
            UPDATE users SET department_id = NULL, is_leader = false WHERE id = ${req.params.user_id}
        `;
        res.json({ message: 'Membro removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- ESTUDOS -----
app.post('/api/studies', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, file_url } = req.body;
        const image_url = req.file ? '/uploads/estudos/' + req.file.filename : null;
        
        const result = await sql`
            INSERT INTO studies (title, description, file_url, image_url)
            VALUES (${title}, ${description}, ${file_url}, ${image_url})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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
        const image_url = req.file ? '/uploads/produtos/' + req.file.filename : null;
        
        const result = await sql`
            INSERT INTO products (name, description, price, image_url, stock, category)
            VALUES (${name}, ${description}, ${parseFloat(price)}, ${image_url}, ${parseInt(stock) || 0}, ${category || ''})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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

app.put('/api/products/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock, category } = req.body;
        const result = await sql`
            UPDATE products SET name = ${name}, description = ${description}, price = ${parseFloat(price)}, 
                stock = ${parseInt(stock) || 0}, category = ${category || ''}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
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
        const image_url = req.file ? '/uploads/eventos/' + req.file.filename : null;
        
        const result = await sql`
            INSERT INTO events (title, description, date, image_url, price)
            VALUES (${title}, ${description}, ${date || new Date()}, ${image_url}, ${parseFloat(price) || 0})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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

app.put('/api/events/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, date, price } = req.body;
        const result = await sql`
            UPDATE events SET title = ${title}, description = ${description}, 
                date = ${date}, price = ${parseFloat(price) || 0}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
    } catch (error) {
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
        const { user_name, user_email, user_phone, items, total, payment_id, payment_method } = req.body;
        const result = await sql`
            INSERT INTO orders (user_name, user_email, user_phone, items, total, payment_id, payment_method)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${JSON.stringify(items)}, ${total}, ${payment_id}, ${payment_method})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', auth, async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        console.log('📦 Vendas carregadas:', orders.length);
        res.json(orders);
    } catch (error) {
        console.error('❌ Erro ao buscar vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----- ESTATÍSTICAS DE VENDAS -----
app.get('/api/sales-stats', auth, pastorOnly, async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas de vendas...');
        
        const totalSales = await sql`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM orders`;
        
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
        
        const topProducts = await sql`
            SELECT 
                items::json->0->>'name' as product_name,
                COUNT(*) as total_sales,
                COALESCE(SUM(total), 0) as total_revenue
            FROM orders 
            WHERE items IS NOT NULL AND items != '' AND items != 'null' AND items != '[]'
            GROUP BY items::json->0->>'name'
            ORDER BY total_sales DESC
            LIMIT 10
        `;
        
        const salesByMethod = await sql`
            SELECT 
                COALESCE(payment_method, 'PIX') as payment_method,
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as total
            FROM orders 
            GROUP BY payment_method
        `;
        
        const recentOrders = await sql`
            SELECT id, user_name, user_email, items, total, status, payment_method, created_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `;

        const result = {
            total: totalSales[0] || { count: 0, total: 0 },
            byDay: salesByDay || [],
            topProducts: topProducts || [],
            byMethod: salesByMethod || [],
            recent: recentOrders || []
        };
        
        console.log('📊 Estatísticas completas:', result);
        res.json(result);
    } catch (error) {
        console.error('❌ Erro nas estatísticas:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// ----- INSCRIÇÕES -----
app.post('/api/registrations', async (req, res) => {
    try {
        const { type, name, email, phone, department_name, event_name, details, amount, is_paid } = req.body;
        const result = await sql`
            INSERT INTO registrations (type, name, email, phone, department_name, event_name, details, amount, is_paid)
            VALUES (${type}, ${name}, ${email}, ${phone || ''}, ${department_name || ''}, ${event_name || ''}, ${details || ''}, ${parseFloat(amount) || 0}, ${is_paid || false})
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

// ----- DOAÇÕES -----
app.post('/api/donations', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, type, amount, payment_id, payment_method } = req.body;
        const result = await sql`
            INSERT INTO donations (user_name, user_email, user_phone, type, amount, payment_id, payment_method)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${type}, ${amount}, ${payment_id}, ${payment_method})
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

// ----- ESCALAS -----
app.post('/api/worship-scales', auth, async (req, res) => {
    try {
        const { department_id, event_date, leader_id, songs, palette, rehearsal } = req.body;
        const result = await sql`
            INSERT INTO worship_scales (department_id, event_date, leader_id, songs, palette, rehearsal)
            VALUES (${department_id}, ${event_date}, ${leader_id}, ${songs}, ${palette}, ${rehearsal || false})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/worship-scales', auth, async (req, res) => {
    try {
        const scales = await sql`
            SELECT ws.*, d.name as department_name, u.name as leader_name
            FROM worship_scales ws
            LEFT JOIN departments d ON ws.department_id = d.id
            LEFT JOIN users u ON ws.leader_id = u.id
            ORDER BY ws.event_date DESC
        `;
        res.json(scales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/worship-scales/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM worship_scales WHERE id = ${req.params.id}`;
        res.json({ message: 'Escala removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- CARROSSEL -----
app.post('/api/carousel', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, link } = req.body;
        const image_url = req.file ? '/uploads/carousel/' + req.file.filename : null;
        if (!image_url) return res.status(400).json({ error: 'Imagem obrigatória' });

        const result = await sql`
            INSERT INTO carousel_images (title, subtitle, image_url, link)
            VALUES (${title || ''}, ${subtitle || ''}, ${image_url}, ${link || ''})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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

app.put('/api/carousel/:id', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, link, active } = req.body;
        
        const current = await sql`SELECT * FROM carousel_images WHERE id = ${id}`;
        if (current.length === 0) {
            return res.status(404).json({ error: 'Imagem não encontrada' });
        }
        
        let image_url = current[0].image_url;
        
        if (req.file) {
            const oldPath = path.join(__dirname, 'public', current[0].image_url);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) {}
            }
            image_url = '/uploads/carousel/' + req.file.filename;
        }

        const result = await sql`
            UPDATE carousel_images 
            SET 
                title = ${title || current[0].title},
                subtitle = ${subtitle || current[0].subtitle},
                link = ${link || current[0].link},
                image_url = ${image_url},
                active = ${active !== undefined ? active : current[0].active}
            WHERE id = ${id}
            RETURNING *
        `;
        
        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao atualizar carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/carousel/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`DELETE FROM carousel_images WHERE id = ${id}`;
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
// ===== MERCADO PAGO (COM REDIRECIONAMENTO) =====
// ============================================

app.post('/api/create-pix-payment', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ 
                error: 'Mercado Pago não configurado' 
            });
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
                // REDIRECIONAMENTO APÓS O PAGAMENTO
                back_urls: {
                    success: `${BASE_URL}/?status=approved&payment_id=${externalReference}`,
                    failure: `${BASE_URL}/?status=rejected&payment_id=${externalReference}`,
                    pending: `${BASE_URL}/?status=pending&payment_id=${externalReference}`
                },
                auto_return: 'approved'
            }
        };

        console.log('📝 Criando pagamento PIX...');
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);
        console.log('📊 Status:', payment.status);

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
        console.error('❌ Erro MP:', error);
        res.status(500).json({ 
            error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') 
        });
    }
});

// ============================================
// ===== GERAR PDF DE CONFIRMAÇÃO =====
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
    console.log('');
});

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Criar pasta para dados e uploads
const uploadsDir = './public/uploads';
const dataDir = './data';
const productsFile = path.join(dataDir, 'products.json');

// Criar diretórios se não existirem
[uploadsDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Carregar produtos salvos ou criar array vazio
let products = [];
try {
    if (fs.existsSync(productsFile)) {
        products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
    }
} catch (error) {
    console.error('Erro ao carregar produtos:', error);
}

// Função para salvar produtos
function saveProducts() {
    try {
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
    } catch (error) {
        console.error('Erro ao salvar produtos:', error);
    }
}

// Configurar multer para upload de imagens
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, 'product-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10000000 } // limite de 10MB
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rota para upload de produto
app.post('/api/products', upload.single('image'), (req, res) => {
    const product = {
        id: Date.now(),
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        image: `/uploads/${req.file.filename}`,
        createdAt: new Date()
    };

    products.unshift(product); // Adicionar no início do array
    saveProducts(); // Salvar no arquivo
    
    // Emitir novo produto para todos os clientes
    io.emit('newProduct', product);
    
    res.json(product);
});

// Rota para obter todos os produtos
app.get('/api/products', (req, res) => {
    res.json(products);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Usuario conectado');
    
    // Enviar produtos imediatamente após conexão
    socket.emit('initialProducts', products);
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo deu errado!');
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// MongoDB setup
mongoose.connect('mongodb+srv://yg2707320:H0D5B2Jm7DNR4aEk@cluster0.uh00tff.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  ssl: true,
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000 // 45 seconds
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  socketId: String
});

const User = mongoose.model('User', UserSchema);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const liveUsers = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('join', async ({ email, name }) => {
    liveUsers[socket.id] = { email, name, socketId: socket.id };
    
    // Insert user data into MongoDB
    try {
      await User.create({ email, name, socketId: socket.id });
      socket.join('live users');
      io.to('live users').emit('userList', Object.values(liveUsers));
    } catch (err) {
      console.error('Error inserting user into MongoDB:', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected', socket.id);
    const user = liveUsers[socket.id];
    
    if (user) {
      delete liveUsers[socket.id];
      
      // Remove user from MongoDB
      try {
        await User.deleteOne({ socketId: socket.id });
        io.to('live users').emit('userList', Object.values(liveUsers));
      } catch (err) {
        console.error('Error deleting user from MongoDB:', err);
      }
    }
  });
});

app.use(express.static('public'));

// Serve the index.html file for the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/user/:socketId', async (req, res) => {
  try {
    const user = await User.findOne({ socketId: req.params.socketId });
    if (user) {
      res.json(user);
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    res.status(500).send('Error retrieving user from MongoDB');
  }
});

server.listen(4000, () => {
  console.log('Server is running on port 4000');
});
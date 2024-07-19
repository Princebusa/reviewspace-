const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
const usersFilePath = path.join(__dirname, 'data', 'users.json');

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Function to check subscription status
const isSubscriptionActive = (subscription) => {
  const currentDate = new Date();
  const startDate = new Date(subscription.startDate);
  const endDate = new Date(subscription.endDate);
  return currentDate >= startDate && currentDate <= endDate;
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
};

// Route for the homepage
app.get('/', (req, res) => {
  res.render('landing');
});
// app.get('/', (req, res) => {
//   res.render('index');
// });

// Route for the login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Route for the registration page
app.get('/register', (req, res) => {
  res.render('register');
});

// Route for the userdashbord page
app.get('/userdash', (req, res) => {
  res.render('dashborduser');
});

// Route for user registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    if (users[username]) {
      return res.status(400).send('User already exists');
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    users[username] = { password: hashedPassword, reviews: [], subscription: { startDate: '', endDate: '' } };
    fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), err => {
      if (err) throw err;
      res.redirect('/login');
    });
  });
});

// Route for user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).send('Invalid credentials');
    }
    req.session.user = username;
    res.redirect('/dashboard');
  });
});

// Route for the dashboard
// Route for the dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
    const username = req.session.user;
    fs.readFile(usersFilePath, (err, data) => {
      if (err) throw err;
      const users = JSON.parse(data);
      const user = users[username];
      res.render('dashboard', { username: username, reviews: user.reviews });
    });
  });
  

// API to get reviews
app.get('/api/reviews', isAuthenticated, (req, res) => {
  const username = req.session.user;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    res.json(users[username].reviews);
  });
});

// API to add a new review
app.post('/api/reviews', isAuthenticated, (req, res) => {
  const username = req.session.user;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];
    const newReview = req.body;
    user.reviews.push(newReview);
    fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), err => {
      if (err) throw err;
      res.json(newReview);
    });
  });
});

// API to update a review
app.put('/api/reviews/:id', isAuthenticated, (req, res) => {
  const username = req.session.user;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];
    const { id } = req.params;
    const updatedReview = req.body;
    const index = user.reviews.findIndex(review => review.id === id);
    if (index !== -1) {
      user.reviews[index] = updatedReview;
      fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), err => {
        if (err) throw err;
        res.json(updatedReview);
      });
    } else {
      res.status(404).json({ message: 'Review not found' });
    }
  });
});

// API to delete a review
app.delete('/api/reviews/:id', isAuthenticated, (req, res) => {
  const username = req.session.user;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];
    const { id } = req.params;
    const updatedReviews = user.reviews.filter(review => review.id !== id);
    user.reviews = updatedReviews;
    fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), err => {
      if (err) throw err;
      res.json({ message: 'Review deleted' });
    });
  });
});

// Route to handle script generation
app.get('/generate-script', isAuthenticated, (req, res) => {
  const username = req.session.user;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];

    if (!isSubscriptionActive(user.subscription)) {
      return res.send('<script>alert("Your subscription has expired. Please renew to continue using the service.");</script>');
    }

    const script = `
      (function() {
        const reviews = ${JSON.stringify(user.reviews)};
        reviews.forEach(review => {
          document.write('<p>' + review.content + '</p>');
        });
      })();
    `;
    res.render('script', { script });
  });
});

// Route to serve the script via API
app.get('/api/script', (req, res) => {
  const { username } = req.query;
  fs.readFile(usersFilePath, (err, data) => {
    if (err) throw err;
    const users = JSON.parse(data);
    const user = users[username];

    if (!user || !isSubscriptionActive(user.subscription)) {
      return res.send('<script>alert("Your subscription has expired or the user does not exist. Please renew or check the username to continue using the service.");</script>');
    }

    const script = `
      (function() {
        const reviews = ${JSON.stringify(user.reviews)};
        reviews.forEach(review => {
          document.write('<p>' + review.content + '</p>');
        });
      })();
    `;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

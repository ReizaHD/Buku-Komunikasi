const pool = require('../../config/db');
const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');

const app = express();

// Middleware to parse application/x-www-form-urlencoded data
router.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON data
router.use(express.json());

router.post('/', async (req, res) =>{

    const {email, password} = req.body;
    try{
        const userQuery= 'SELECT * FROM users WHERE (user_name = $1 OR user_email = $1)';
        const {rows} = await pool.query(userQuery, [email]);

        if (rows.length < 1) {
            return res.json({ success: false, message: 'Invalid username/email or password.' });
        }

        

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.json({success: false, message: 'Invalid username/email or password.'});
        }

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            data: {
              user_id: user.user_id,
              user_name: user.user_name,
              user_image: user.user_image,
              user_email: user.user_email,
              profile: user.profile,
            },
          });

    } catch (error) {
        console.error('Error logging in:', error);
    }
});

router.post('/edit_password', async (req, res) => {
    const {password, password1, password2, username, id} = req.body;
    try {
        // Query to find the user by email
        const userQuery = 'SELECT * FROM users WHERE user_name = $1 AND user_id = $2';
        const { rows } = await pool.query(userQuery, [username, id]);

        if (rows.length < 1) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = rows[0];

        // Compare current password with the stored password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        }

        if(!(password1 == password2)){
            return res.status(401).json({ success: false, message: 'Re-confirm password is incorrect.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(password1, 10);

        // Update the user's password in the database
        const updateQuery = 'UPDATE users SET password = $1 WHERE user_name = $2 AND user_id= $3';
        await pool.query(updateQuery, [hashedNewPassword, username, id]);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Password updated successfully!',
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }

});

router.post('/students', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
    }

    try {
        // Query to fetch student data
        const query = 'SELECT student_id AS id, student_name AS name, class FROM students WHERE user_id = $1';
        const result = await pool.query(query, [user_id]);

        // Send results as JSON
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).json({ error: 'Query failed' });
    }
});

module.exports = router;
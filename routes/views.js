const express = require('express');
const pool = require('../config/db');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
const fcm = require('../config/firebase_notification');
require('dotenv').config(); // Load your environment variables

router.use(express.urlencoded({ extended: true }));
router.use(express.json());


const storage = multer.memoryStorage(); // Use memory storage for direct file access
const upload = multer({ storage });

router.all('/add_announcement_or_feedback', upload.array('image', 10), async (req, res) => {
    const client = await pool.connect();
    let html;

    try {
        // Read the HTML file once at the start
        const filePath = path.join(__basedir, 'views', 'insert_announcement_or_feedback.html');
        html = await fs.promises.readFile(filePath, 'utf8');
  
        if (req.method === 'POST') {
            const files = req.files;
            const {
                type, // Announcement type (1 = Feedback, 2 = Announcement)
                student_id,
                additional_feedback,
                weekend_assignment,
                extracurricular,
                subject_feedback,
                subject_id,
                content,
            } = req.body;

            await client.query('BEGIN'); // Start the transaction

            if (type === '1') {
                // Insert feedback and retrieve feedback_id
                const feedbackQuery = `
                    INSERT INTO feedback (student_id, additional_feedback, weekend_assignment, extracurricular, feedback_date)
                    VALUES ($1, $2, $3, $4, NOW()) RETURNING feedback_id
                `;
                const feedbackResult = await client.query(feedbackQuery, [
                    student_id,
                    additional_feedback,
                    weekend_assignment,
                    extracurricular,
                ]);
                const feedback_id = feedbackResult.rows[0].feedback_id;

                // Prepare subject feedback data in one go
                const subjectFeedbackData = subject_id
                    .map((id, index) => ({
                        id,
                        text: subject_feedback[index],
                    }))
                    .filter(item => item.text); // Filter out empty feedback

                // Batch insert subject feedback if any
                if (subjectFeedbackData.length > 0) {
                    const subjectFeedbackQuery = `
                        INSERT INTO subject_feedback (feedback_id, subject_id, feedback)
                        VALUES ${subjectFeedbackData.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ')}
                    `;
                    const params = [feedback_id, ...subjectFeedbackData.flatMap(item => [item.id, item.text])];
                    await client.query(subjectFeedbackQuery, params);
                }

                // Insert into announcements (Feedback)
                await client.query(`
                    INSERT INTO announcements (announcement_type, feedback_id, announcement_date)
                    VALUES (1, $1, NOW())
                `, [feedback_id]);

            } else if (type === '2') {
                // Upload images concurrently
                const uploadPromises = files.map(file => {
                    const timestamp = Date.now(); // Get the current time in milliseconds
                    const originalExtension = file.originalname.split('.').pop(); // Extract the original file extension
                    const newFilename = `${timestamp}.${originalExtension}`; // Create a new filename
  
                    return put(newFilename, file.buffer, {
                        access: 'public',
                    }).then(blob => blob.url); // Return the file URL
                });

                const uploadResults = await Promise.all(uploadPromises); // Wait for all uploads

                // Insert into announcements (Announcement)
                await client.query(`
                    INSERT INTO announcements (announcement_type, content, image, announcement_date)
                    VALUES (2, $1, $2, NOW())
                `, [content, uploadResults]);
            }

            await client.query('COMMIT'); // Commit transaction

            // Send FCM notification asynchronously
            const topic = "Berita"; // Replace with your topic name
            const payload = {
                title: "Breaking News!",
                body: "Here is the latest update on today's news.",
                data: { category: "news", importance: "high" },
            };
            fcm.sendNotificationToTopic(topic, payload); // FCM is sent async

            html = html.replace('<!-- SUCCESS_MESSAGE -->', "Successfully submitted");
        }

        // Fetch students and subjects in parallel
        const [studentsResult, subjectsResult] = await Promise.all([
            client.query("SELECT student_id, student_name FROM students"),
            client.query("SELECT subject_id, subject_name FROM subjects"),
        ]);

        const studentOptions = studentsResult.rows.map(student => `
            <option value="${student.student_id}">${student.student_name}</option>
        `).join('');

        const subjectFeedback = subjectsResult.rows.map(subject => `
            <label>${subject.subject_name}:</label>
            <textarea class="form-control" name="subject_feedback[]"></textarea><br>
            <input type="hidden" name="subject_id[]" value="${subject.subject_id}">
        `).join('');

        // Populate the HTML dynamically
        const populatedHtml = html
            .replace('<!-- STUDENT_OPTIONS -->', studentOptions)
            .replace('<!-- SUBJECT_FEEDBACK -->', subjectFeedback);

        res.send(populatedHtml);

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Error: ", error.message);
        res.status(500).send("Error: " + error.message);
    } finally {
        client.release(); // Always release the client
    }
});

  module.exports = router;
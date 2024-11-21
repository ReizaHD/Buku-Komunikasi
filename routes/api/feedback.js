const pool = require('../../config/db');
const express = require('express');
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.get("/lol", async (req, res) =>{
  const feedbackResult = await pool.query(
    "SELECT current_timestamp as feedback_date;"
  );
  const feedback_date =  feedbackResult.rows.map(row => row.feedback_date);
  res.json({"LOL":feedback_date});

});

router.get("/", async (req, res) => {
  try {
    // Fetch all feedback details
    const feedbackResult = await pool.query(
      "SELECT * FROM feedback ORDER BY feedback_date DESC"
    );

    // Get all unique student IDs from feedback
    const studentIds = [...new Set(feedbackResult.rows.map(row => row.student_id))];

    // Fetch all student details in a single query
    const studentResult = await pool.query(
      "SELECT * FROM students WHERE student_id = ANY($1)",
      [studentIds]
    );

    // Create a map of student_id to student details
    const studentMap = {};
    studentResult.rows.forEach(student => {
      studentMap[student.student_id] = student;
    });

    // Get all feedback IDs
    const feedbackIds = feedbackResult.rows.map(row => row.feedback_id);

    // Fetch all subject feedbacks in one query
    const subjectFeedbackResult = await pool.query(
      "SELECT * FROM subject_feedback WHERE feedback_id = ANY($1)",
      [feedbackIds]
    );

    // Fetch all subjects in one query
    const subjectIds = [...new Set(subjectFeedbackResult.rows.map(row => row.subject_id))];
    const subjectResult = await pool.query(
      "SELECT * FROM subjects WHERE subject_id = ANY($1)",
      [subjectIds]
    );

    // Create a map of subject_id to subject name
    const subjectMap = {};
    subjectResult.rows.forEach(subject => {
      subjectMap[subject.subject_id] = subject.subject_name;
    });

    // Combine all the data
    const combinedData = feedbackResult.rows.map(row => {
      const student = studentMap[row.student_id] || {};
      const feedbackSubjects = subjectFeedbackResult.rows
        .filter(sf => sf.feedback_id === row.feedback_id)
        .reduce((subjects, sf) => {
          const subjectName = subjectMap[sf.subject_id];
          if (subjectName) {
            subjects[subjectName] = sf.feedback;
          }
          return subjects;
        }, {});

      return {
        feedback_id: parseInt(row.feedback_id),
        student_id: parseInt(row.student_id),
        student_name: student.student_name || "",
        student_class: student.class || "",
        subjects: feedbackSubjects,
        additional_feedback: row.additional_feedback,
        weekend_assignment: row.weekend_assignment,
        extracurricular: row.extracurricular,
        parent_feedback: row.parent_feedback,
        is_read: row.is_read,
        date: new Date(row.feedback_date).toISOString().split("T")[0],
      };
    });

    // Send JSON response with the feedback data
    res.json({
      status: "success",
      data: combinedData,
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ status: "error", message: "An error occurred" });
  }
});

router.post('/read', async (req, res) => {
  try {
    const { feedback_id } = req.body;

    const isReadResult = await pool.query(
      'SELECT is_read FROM feedback WHERE feedback_id = $1',
      [feedback_id]
    );

    if (isReadResult.rowCount === 0) {
      return res.json({ success: false, message: 'The feedback is not available' });
    }

    if (isReadResult.rows[0].is_read) {
      return res.json({ success: false, message: 'The feedback is already read' });
    }

    const queryResult = await pool.query(
      'UPDATE feedback SET is_read = true WHERE feedback_id = $1 RETURNING *;',
      [feedback_id]
    );

    if (queryResult.rowCount > 0) {
      return res.json({ success: true, message: 'Update successful' });
    } else {
      return res.json({ success: false, message: 'No rows updated' });
    }
  } catch (error) {
    return res.json({ success: false, message: 'Update failed', error: error.message });
  }
});

router.post('/insert_parent', async (req, res) => {
  const {feedback_id, parent_feedback} = req.body;
  try{
    const isExistQuery = await pool.query(
      'SELECT parent_feedback FROM feedback WHERE feedback_id = $1 AND parent_feedback IS NOT NULL;',
      [feedback_id]
    );
    if (isExistQuery.rowCount > 0) {
      return res.json({ success: false, message: 'Parent Feedback is already exist', error_code: 1});
    }
    
    const queryResult = await pool.query(
      'UPDATE feedback SET parent_feedback = $1 WHERE feedback_id = $2;',
      [parent_feedback, feedback_id]
    );

    if (queryResult.rowCount > 0) {
      return res.json({ success: true, message: 'Update successful' });
    } else {
      return res.json({ success: false, message: 'No rows updated' });
    }
  }catch(error){
    return res.json({ success: false, message: 'Update failed', error: error.message });
  }
});


module.exports = router;

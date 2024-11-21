const pool = require('../../config/db');
const express = require('express');
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.get("/", async (req, res) => {
    try {
      // Fetch all announcements (including feedback entries)
      const announcementResult = await pool.query(
        "SELECT * FROM announcements"
      );
  
      // Separate feedback and announcement types
      const feedbackEntries = announcementResult.rows.filter(
        (row) => row.announcement_type === 1
      );
      const announcementEntries = announcementResult.rows.filter(
        (row) => row.announcement_type === 2
      );
  
      // Get all feedback IDs from announcements
      const feedbackIds = feedbackEntries.map((row) => row.feedback_id);
  
      // Fetch all feedback details for feedback entries
      const feedbackResult = await pool.query(
        "SELECT * FROM feedback WHERE feedback_id = ANY($1)",
        [feedbackIds]
      );
  
      // Get all unique student IDs from feedback
      const studentIds = [...new Set(feedbackResult.rows.map((row) => row.student_id))];
  
      // Fetch all student details in a single query
      const studentResult = await pool.query(
        "SELECT * FROM students WHERE student_id = ANY($1)",
        [studentIds]
      );
  
      // Create a map of student_id to student details
      const studentMap = {};
      studentResult.rows.forEach((student) => {
        studentMap[student.student_id] = student;
      });
  
      // Fetch all subject feedbacks for feedback entries
      const subjectFeedbackResult = await pool.query(
        "SELECT * FROM subject_feedback WHERE feedback_id = ANY($1)",
        [feedbackIds]
      );
  
      // Fetch all subjects in one query
      const subjectIds = [...new Set(subjectFeedbackResult.rows.map((row) => row.subject_id))];
      const subjectResult = await pool.query(
        "SELECT * FROM subjects WHERE subject_id = ANY($1)",
        [subjectIds]
      );
  
      // Create a map of subject_id to subject name
      const subjectMap = {};
      subjectResult.rows.forEach((subject) => {
        subjectMap[subject.subject_id] = subject.subject_name;
      });
  
      // Combine feedback details
      const feedbackData = feedbackResult.rows.map((row) => {
        const student = studentMap[row.student_id] || {};
        const feedbackSubjects = subjectFeedbackResult.rows
          .filter((sf) => sf.feedback_id === row.feedback_id)
          .reduce((subjects, sf) => {
            const subjectName = subjectMap[sf.subject_id];
            if (subjectName) {
              subjects[subjectName] = sf.feedback;
            }
            return subjects;
          }, {});
  
        return {
          type: "feedback",
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
  
      // Combine announcement details
      const announcementData = announcementEntries.map((row) => ({
        type: "announcement",
        announcement_id: parseInt(row.announcement_id),
        content: row.content,
        image: row.image,
        date: new Date(row.announcement_date).toISOString().split("T")[0],
      }));
  
      // Combine both feedback and announcements
      const combinedData = [...feedbackData, ...announcementData];
  
      // Sort the combined data by date in descending order
      combinedData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
      // Send JSON response
      res.json({
        status: "success",
        data: combinedData,
      });
    } catch (error) {
      console.error("Error fetching data:", error.message);
      res.status(500).json({ status: "error", message: "An error occurred" });
    }
  });

module.exports = router;
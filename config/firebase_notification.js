// FirebaseNotification.js
const admin = require("firebase-admin");

class firebase_notification {
  // Static attribute for Firebase Admin SDK initialization
  static serviceAccount = require("./service_account.json");

  // Static method to initialize Firebase
  static initializeApp() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebase_notification.serviceAccount),
      });
      console.log("Firebase Admin SDK initialized.");
    }
  }

  // Static method to send notification to a topic
  static async sendNotificationToTopic(topic, payload) {
    // Ensure Firebase is initialized before sending notifications
    firebase_notification.initializeApp();

    try {
      const response = await admin.messaging().send({
        topic: topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data, // Optional, for custom data
      });
      console.log(`Notification sent to topic "${topic}" successfully:`, response);
    } catch (error) {
      console.error(`Error sending notification to topic "${topic}":`, error);
    }
  }
}

module.exports = firebase_notification;  // Exporting the class

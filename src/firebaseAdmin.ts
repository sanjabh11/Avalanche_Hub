import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

let adminApp: admin.app.App | null = null;

export function getAdminDb() {
  if (!adminApp) {
    adminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId,
      databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`
    });
  }
  return adminApp.firestore();
}

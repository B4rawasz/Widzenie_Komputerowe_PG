const mpHands = require("@mediapipe/hands");

// Eksportujemy nazwany export 'Hands', którego szuka biblioteka TF.js
export const Hands = mpHands.Hands;

// Eksportujemy też resztę, aby zachować zgodność
export const VERSION = mpHands.VERSION;
export const HAND_CONNECTIONS = mpHands.HAND_CONNECTIONS;
export default mpHands;

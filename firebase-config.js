// 수학도서관 얼리어답터 — Firebase 웹 앱 설정
// 이 값들은 공개되어도 되는 앱 식별 정보입니다. 학생 자료는 로그인과 Firestore 규칙으로 보호됩니다.
export const firebaseConfig = {
  apiKey: "AIzaSyCHTsFIv1RaQB6fEvjP_oxHGJJr0ululC0",
  authDomain: "sudo-earlyadopter.firebaseapp.com",
  projectId: "sudo-earlyadopter",
  storageBucket: "sudo-earlyadopter.firebasestorage.app",
  messagingSenderId: "66412645637",
  appId: "1:66412645637:web:83e922a23927e32b7c7b6c"
};

// 원장님 계정 (모든 권한). Firestore 규칙의 이메일과 같아야 합니다.
export const OWNER_EMAIL = "ilmvm66@gmail.com";

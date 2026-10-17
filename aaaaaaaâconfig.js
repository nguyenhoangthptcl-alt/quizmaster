/* ============================================================
   CẤU HÌNH CHUNG - Thầy chỉ cần sửa file này 1 lần duy nhất
   (xem HUONG_DAN.md, Bước 1 để lấy các thông số Firebase)
   ============================================================ */
window.QM_CONFIG = {
  // Dán thông số Firebase của thầy vào đây (Project settings -> Your apps -> Web app)
  firebase: {
  apiKey: "AIzaSyCsPAV6HoWKDaiu4eSbKfVBCnbsk9357vc",
  authDomain: "dautruongcn.firebaseapp.com",
  projectId: "dautruongcn",
  storageBucket: "dautruongcn.firebasestorage.app",
  messagingSenderId: "660069296942",
  appId: "1:660069296942:web:68c8aa036c60a13da0e8bf",
  measurementId: "G-426PXYJWBC"
  },

  // Tên đăng nhập được chuyển thành email ảo dạng  ten@quizmaster.local  (không gửi thư thật)
  usernameDomain: "quizmaster.local",

  // Mô hình Gemini mặc định. Tên mô hình Google đổi thường xuyên, nên app tự thử lần lượt
  // các tên trong danh sách dự phòng nếu tên đầu tiên bị báo "not found".
  defaultGeminiModel: "gemini-3.6-flash",
  geminiFallbackModels: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"]
};

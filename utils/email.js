// utils/email.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Reusable function to send any EmailJS email
 */
export const sendEmail = async ({ templateId, templateParams }) => {
  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: templateId,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: templateParams,
    accessToken: process.env.EMAILJS_PRIVATE_KEY, // Required for strict mode
  };

  try {
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Email "${templateId}" sent:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send "${templateId}" email:`, error.response?.data || error.message);
    throw error;
  }
};

export const sendApprovalEmail = (user) => {
    return sendEmail({
      templateId: process.env.EMAILJS_TEMPLATE_ID, // Admin template
      templateParams: {
        name: user.name,
        email: user.email,
        approve_url: `https://math-test-generator-back.onrender.com/api/auth/approve/${user._id}`,
      },
    });
  };

  
  export const sendUserApprovedEmail = (user) => {
    return sendEmail({
      templateId: process.env.EMAILJS_APPROVAL_TEMPLATE_ID, // User template
      templateParams: {
        name: user.name,
        email: user.email,
        user_id: user._id
      },
    });
  };
  
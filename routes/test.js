import express from 'express';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import stream from 'stream';
import mongoose from 'mongoose';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// ✅ Schema supports string or array for image_url
const questionSchema = new mongoose.Schema({
  question_id: String,
  number: Number,
  topic: String,
  exam: String,
  examNumber: String,
  image_url: mongoose.Schema.Types.Mixed,
});

const Question =
  mongoose.models.Question ||
  mongoose.model('Question', questionSchema, 'questions');

// ✅ Generate test route (only for authenticated & approved users)
router.post('/generate-test', isAuthenticated, async (req, res) => {
  const { topics, mixExams, examNumber } = req.body;

  try {
    let questions = [];

    if (mixExams) {
  if (!examNumber) {
    return res.status(400).json({ error: 'Missing exam number for mix mode.' });
  }

  const topicsInExam = await Question.distinct('topic', { examNumber });

  for (const topic of topicsInExam) {
    const sample = await Question.aggregate([
      { $match: { topic, examNumber } },
      { $sample: { size: 1 } },
    ]);

    if (sample.length > 0) {
      questions.push(...sample);
    }
  }
}
 else {
      if (!Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: 'Please select at least one topic.' });
      }

      if (!examNumber) {
        return res.status(400).json({ error: 'Missing exam number.' });
      }

      for (const topic of topics) {
        const sample = await Question.aggregate([
          { $match: { topic, examNumber } },
          { $sample: { size: 1 } },
        ]);

        if (sample.length < 1) {
          return res.status(400).json({
            error: `Not enough questions for topic "${topic}" in exam ${examNumber}.`,
          });
        }

        questions.push(...sample);
      }
    }

    // ✅ Create PDF
    const doc = new PDFDocument();
    const bufferStream = new stream.PassThrough();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=math-test.pdf');

    doc.pipe(bufferStream);
    bufferStream.pipe(res);

    // ✅ Sort questions by number
    questions.sort((a, b) => a.number - b.number);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (i !== 0) doc.addPage();

      const urls = Array.isArray(question.image_url)
        ? question.image_url
        : [question.image_url];

      for (let j = 0; j < urls.length; j++) {
        const urlRaw = urls[j];

        if (j > 0) doc.addPage();

        if (j === 0) {
          doc.fontSize(14).text(`Question ${question.number} - ${question.topic}:`, { align: 'left' });
          doc.moveDown();
          doc.fontSize(12).text(`Exam: ${question.exam}`, { align: 'left' });
          doc.moveDown();
        }

        try {
          let url = urlRaw;
          if (url.includes('github.com') && url.includes('/blob/')) {
            url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '');
          }

          const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
          const imgBuffer = Buffer.from(imageResponse.data, 'binary');

          doc.image(imgBuffer, {
            fit: [500, 500],
            align: 'center',
            valign: 'top',
          });

          doc.moveDown(1);
        } catch (err) {
          doc.text(`⚠️ Failed to load image: ${urlRaw}`);
          doc.moveDown();
        }
      }
    }

    doc.end();
  } catch (err) {
    console.error('❌ PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

export default router;

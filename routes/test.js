// routes/test.js
import express from 'express';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import stream from 'stream';
import mongoose from 'mongoose';

const router = express.Router();

const questionSchema = new mongoose.Schema({
  question_id: String,
  number: Number,
  topic: String,
  exam: String,
  image_url: String
});

const Question =  mongoose.models.Question || mongoose.model('Question', questionSchema, 'questions');

router.post('/generate-test', async (req, res) => {
  const { topics, mixExams } = req.body;

  try {
    let questions = [];

    if (mixExams) {
      const allTopics = await Question.distinct('topic');

      for (const topic of allTopics) {
        const sample = await Question.aggregate([
          { $match: { topic } },
          { $sample: { size: 1 } }
        ]);

        if (sample.length === 0) {
          return res.status(400).json({ error: `No questions available for topic: ${topic}` });
        }

        questions.push(...sample);
      }
    } else {
      if (!Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: 'Please select at least one topic.' });
      }

      const topicSamples = [];

      for (const topic of topics) {
        const sample = await Question.aggregate([
          { $match: { topic } },
          { $sample: { size: 2 } }
        ]);

        if (sample.length < 2) {
          return res.status(400).json({ error: `Not enough questions for topic: ${topic}` });
        }

        topicSamples.push(...sample);
      }

      questions = topicSamples;
    }

    const doc = new PDFDocument();
    const bufferStream = new stream.PassThrough();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=math-test.pdf');

    doc.pipe(bufferStream);
    bufferStream.pipe(res);

    questions.sort((a, b) => a.number - b.number);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (i !== 0) doc.addPage();

      doc.fontSize(14).text(`Question ${question.number} - ${question.topic}:`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Exam: ${question.exam}`, { align: 'left' });
      doc.moveDown();

      try {
        let url = question.image_url;
        if (url.includes('github.com') && url.includes('/blob/')) {
          url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '');
        }

        const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
        const imgBuffer = Buffer.from(imageResponse.data, 'binary');

        doc.image(imgBuffer, 50, doc.y, {
          fit: [500, 500],
          align: 'center',
        });
      } catch (err) {
        doc.text('⚠️ Failed to load image.');
      }
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

export default router;
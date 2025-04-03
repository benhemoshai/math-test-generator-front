import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import stream from 'stream';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const questionSchema = new mongoose.Schema({
  question_id: String,
  number: Number,
  topic: String,
  exam: String,
  image_url: String
});

const Question = mongoose.model('Question', questionSchema, 'questions');

// PDF endpoint
app.post('/generate-test', async (req, res) => {
  const { topics, mixExams } = req.body;

  if (!Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({ error: 'Please select at least one topic.' });
  }

  try {
    // Build match criteria
    const match = { topic: { $in: topics } };
    if (!mixExams) {
      match.exam = "2024 Summer A"; // default single exam
    }

    // Sample 8 random questions matching the criteria
    const questions = await Question.aggregate([
      { $match: match },
      { $sample: { size: 8 } }
    ]);

    if (questions.length < 8) {
      return res.status(400).json({ error: 'Not enough questions available for selected topics.' });
    }

    // Generate PDF
    const doc = new PDFDocument();
    const bufferStream = new stream.PassThrough();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=math-test.pdf');

    doc.pipe(bufferStream);
    bufferStream.pipe(res);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (i !== 0) doc.addPage();

      doc.fontSize(14).text(`Question ${question.number}:`, { align: 'left' });
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


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

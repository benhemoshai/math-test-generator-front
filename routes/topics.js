// routes/topics.js
import express from 'express';
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

router.get('/topics', async (req, res) => {
  try {
    const orderedTopics = await Question.aggregate([
      {
        $group: {
          _id: '$number',
          topic: { $first: '$topic' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const topics = orderedTopics.map(t => t.topic);
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

export default router;

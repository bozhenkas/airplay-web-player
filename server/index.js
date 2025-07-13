const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Функция для определения Content-Type по расширению
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
    case '.h265':
    case '.hevc':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

// Получение метаданных по абсолютному пути
app.get('/api/metadata', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    console.error('Путь к файлу не передан');
    return res.status(400).json({ error: 'Путь к файлу не передан' });
  }
  if (!fs.existsSync(filePath)) {
    console.error('Файл не найден:', filePath);
    return res.status(404).json({ error: 'Файл не найден: ' + filePath });
  }
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (e) {
    console.error('Нет прав на чтение файла:', filePath, e);
    return res.status(403).json({ error: 'Нет прав на чтение файла: ' + filePath });
  }
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      console.error('Ошибка ffprobe:', err);
      return res.status(500).json({ error: 'Ошибка ffprobe: ' + err.message });
    }
    try {
      // Формируем полные названия дорожек
      const processedStreams = (metadata.streams || []).map(stream => {
        let fullTitle = '';
        if (stream.codec_type === 'audio') {
          const language = stream.tags?.language || stream.tags?.lang || '';
          const title = stream.tags?.title || '';
          const handler = stream.tags?.handler_name || '';
          const comment = stream.tags?.comment || '';
          fullTitle = [language, title, handler, comment].filter(Boolean).join(', ');
          if (!fullTitle) {
            fullTitle = `Audio Track ${stream.index + 1}, ${stream.codec_name || 'Unknown'}`;
          }
        } else if (stream.codec_type === 'subtitle') {
          const language = stream.tags?.language || stream.tags?.lang || '';
          const title = stream.tags?.title || '';
          const handler = stream.tags?.handler_name || '';
          const comment = stream.tags?.comment || '';
          fullTitle = [language, title, handler, comment].filter(Boolean).join(', ');
          if (!fullTitle) {
            fullTitle = `Subtitle Track ${stream.index + 1}, ${stream.codec_name || 'Unknown'}`;
          }
        }
        return {
          ...stream,
          full_title: fullTitle
        };
      });
      res.json({
        ...metadata,
        streams: processedStreams
      });
    } catch (e) {
      console.error('Ошибка обработки метаданных:', e);
      return res.status(500).json({ error: 'Ошибка обработки метаданных: ' + e.message });
    }
  });
});

// Стриминг видео по абсолютному пути
app.get('/api/stream', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден' });
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getContentType(filePath);
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Фронтенд
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
}); 
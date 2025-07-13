import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Volume2, VolumeX, Maximize, FileVideo } from 'lucide-react';
import axios from 'axios';
import './App.css';

function getMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  switch (ext) {
    case 'mp4':
    case 'm4v':
    case 'h265':
    case 'hevc':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'mov':
      return 'video/quicktime';
    default:
      return '';
  }
}

function App() {
  const [filePath, setFilePath] = useState('');
  const [manualPath, setManualPath] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [subtitleSrc, setSubtitleSrc] = useState('');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Получение аудиодорожек и субтитров
  const audioTracks = metadata?.streams?.filter(stream => stream.codec_type === 'audio') || [];
  const subtitleTracks = metadata?.streams?.filter(stream => stream.codec_type === 'subtitle') || [];

  // Получение метаданных с сервера
  const fetchMetadata = async (path) => {
    setIsLoading(true);
    setError(null);
    setMetadata(null);
    try {
      const res = await axios.get('/api/metadata', { params: { path } });
      setMetadata(res.data);
    } catch (e) {
      if (e.response && e.response.data && e.response.data.error) {
        setError(e.response.data.error);
      } else {
        setError('Ошибка получения метаданных. Проверьте путь и права доступа.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Проверка поддержки формата браузером
  const checkFormatSupport = (path) => {
    const mime = getMimeType(path);
    if (!mime) {
      setError('Неизвестный формат файла.');
      return;
    }
    const video = document.createElement('video');
    const canPlay = video.canPlayType(mime);
    if (canPlay === '' || canPlay === 'no') {
      setError('Этот формат не поддерживается вашим браузером. Используйте VLC, mpv или другой плеер.');
    } else {
      setError(null);
    }
  };

  // Обработка выбора файла через input
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.path) {
      setFilePath(file.path);
      checkFormatSupport(file.path);
      fetchMetadata(file.path);
    } else {
      setFilePath('');
      setError('Браузер не предоставляет путь к файлу. Введите путь вручную.');
    }
  };

  // Drag & Drop обработчики
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.path) {
      setFilePath(file.path);
      checkFormatSupport(file.path);
      fetchMetadata(file.path);
    } else {
      setFilePath('');
      setError('Браузер не предоставляет путь к файлу. Введите путь вручную.');
    }
  };

  // Обработка ручного ввода пути
  const handleManualPath = () => {
    if (manualPath) {
      setFilePath(manualPath);
      checkFormatSupport(manualPath);
      fetchMetadata(manualPath);
    }
  };

  // Видео обработчики
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };
  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Переключение аудио- и субтитровых дорожек
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.audioTracks && video.audioTracks.length) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === selectedAudioTrack;
      }
    }
    if (selectedSubtitleTrack >= 0) {
      setSubtitleSrc(`/api/subtitle?path=${encodeURIComponent(filePath)}&index=${selectedSubtitleTrack}`);
    } else {
      setSubtitleSrc('');
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'disabled';
        }
      }
    }
  }, [selectedAudioTrack, selectedSubtitleTrack, filePath]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>🎬 AirPlay Локальный Плеер</h1>
          <div className="header-actions">
            <button 
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileVideo size={20} />
              Выбрать файл
            </button>
          </div>
        </div>
      </div>
      <div className="main-content">
        {!filePath ? (
          <>
            <div 
              className="upload-area"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="upload-content">
                <Upload size={64} className="upload-icon" />
                <h2>Перетащите видеофайл сюда</h2>
                <p>или нажмите кнопку "Выбрать файл" в заголовке</p>
                <p className="supported-formats">
                  Поддерживаемые форматы: MP4, MKV, AVI, MOV, WebM, HEVC, M4V
                </p>
              </div>
            </div>
            <div className="manual-path-block">
              <p>Если путь не определяется автоматически, введите абсолютный путь к файлу:</p>
              <input
                type="text"
                className="manual-path-input"
                placeholder="/Users/username/Videos/movie.mkv"
                value={manualPath}
                onChange={e => setManualPath(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleManualPath} style={{marginLeft: 8}}>Открыть по пути</button>
            </div>
          </>
        ) : (
          <div className="player-container">
            <div 
              className="video-wrapper"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setShowControls(false)}
            >
              <video
                ref={videoRef}
                className="video-player"
                src={filePath ? `/api/stream?path=${encodeURIComponent(filePath)}` : ''}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onDoubleClick={handleFullscreen}
                controls
                crossOrigin="anonymous"
              >
                {subtitleSrc && (
                  <track kind="subtitles" src={subtitleSrc} default />
                )}
              </video>
              {showControls && (
                <div className="video-controls">
                  <div className="progress-bar" onClick={handleSeek}>
                    <div 
                      className="progress-fill"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <div className="controls-main">
                    <button 
                      className="control-btn"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <div className="time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                    <div className="volume-controls">
                      <button 
                        className="control-btn"
                        onClick={handleMuteToggle}
                      >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="volume-slider"
                      />
                    </div>
                    <button 
                      className="control-btn"
                      onClick={handleFullscreen}
                    >
                      <Maximize size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="file-info">
              <h3>{filePath}</h3>
            </div>
            <div className="tracks-section">
              <div className="track-group">
                <h4>🎵 Аудиодорожки</h4>
                <select 
                  value={selectedAudioTrack}
                  onChange={(e) => setSelectedAudioTrack(parseInt(e.target.value))}
                  className="track-select"
                >
                  {audioTracks.map((track, index) => (
                    <option key={track.index} value={index}>
                      {track.full_title || `Audio Track ${track.index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              {subtitleTracks.length > 0 && (
                <div className="track-group">
                  <h4>📝 Субтитры</h4>
                  <select 
                    value={selectedSubtitleTrack}
                    onChange={(e) => setSelectedSubtitleTrack(parseInt(e.target.value))}
                    className="track-select"
                  >
                    <option value={-1}>Отключено</option>
                    {subtitleTracks.map((track, index) => (
                      <option key={track.index} value={index}>
                        {track.full_title || `Subtitle Track ${track.index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="spinner"></div>
              <p>Загрузка метаданных...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="error-message">
            <p>{error}</p>
            {(error.includes('Нет прав на чтение файла') || error.includes('Permission denied')) && (
              <div className="error-hint">
                <p>Возможно, у вас нет прав на чтение файла. Попробуйте выполнить в терминале:</p>
                <pre>chmod +r /полный/путь/к/вашему/файлу</pre>
                <p>или, если файл принадлежит другому пользователю:</p>
                <pre>sudo chown $(whoami) /полный/путь/к/вашему/файлу</pre>
              </div>
            )}
            {error.includes('Файл не найден') && (
              <div className="error-hint">
                <p>Проверьте, что путь к файлу указан верно и файл существует.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.avi,.mov,.webm,.h265,.hevc"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default App; 
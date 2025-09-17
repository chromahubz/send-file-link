import QRCode from 'qrcode';

class SendFileLinkApp {
  constructor() {
    this.boardId = null;
    this.saveTimeout = null;
    this.apiBaseUrl = '/api';
    this.mockMode = false; // Use real Blob storage
    this.initializeMockStorage();

    this.initializeApp();
    this.setupEventListeners();
    this.loadOrCreateBoard();
  }

  initializeMockStorage() {
    // Initialize or load from localStorage for persistent mock data
    const storedData = localStorage.getItem('sendFileLink_mockData');
    if (storedData) {
      try {
        this.mockData = JSON.parse(storedData);
      } catch (error) {
        console.error('Error parsing stored mock data:', error);
        this.mockData = { boards: {}, media: [], shareMap: {} };
      }
    } else {
      this.mockData = { boards: {}, media: [], shareMap: {} };
    }

    // Ensure shareMap exists
    if (!this.mockData.shareMap) {
      this.mockData.shareMap = {};
    }
  }

  saveMockStorage() {
    // Save mock data to localStorage for persistence
    try {
      localStorage.setItem('sendFileLink_mockData', JSON.stringify(this.mockData));
    } catch (error) {
      console.error('Error saving mock data to localStorage:', error);
    }
  }

  initializeApp() {
    // Theme management
    this.setupTheme();

    // Get DOM elements
    this.elements = {
      textArea: document.getElementById('textArea'),
      saveStatus: document.getElementById('saveStatus'),
      shareUrl: document.getElementById('shareUrl'),
      copyBtn: document.getElementById('copyBtn'),
      qrBtn: document.getElementById('qrBtn'),
      shareBtn: document.getElementById('shareBtn'),
      newBoardBtn: document.getElementById('newBoardBtn'),
      uploadBtn: document.getElementById('uploadBtn'),
      fileInput: document.getElementById('fileInput'),
      dropZone: document.getElementById('dropZone'),
      gallery: document.getElementById('gallery'),
      notice: document.getElementById('notice'),
      boardIdLabel: document.getElementById('boardIdLabel'),
      themeToggle: document.getElementById('themeToggle'),
      shareModal: document.getElementById('shareModal'),
      shareCancel: document.getElementById('shareCancel'),
      shareConfirm: document.getElementById('shareConfirm'),
      slugInput: document.getElementById('slugInput'),
      expirySelect: document.getElementById('expirySelect'),
      shareResult: document.getElementById('shareResult'),
      shareResultInput: document.getElementById('shareResultInput'),
      shareCopy: document.getElementById('shareCopy'),
      qrModal: document.getElementById('qrModal'),
      qrCode: document.getElementById('qrCode'),
      qrClose: document.getElementById('qrClose'),
      lightbox: document.getElementById('lightbox'),
      lightboxClose: document.getElementById('lightboxClose'),
      lightboxImg: document.getElementById('lightboxImg'),
      lightboxDownload: document.getElementById('lightboxDownload')
    };
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }

  setupEventListeners() {
    // Text area auto-save
    this.elements.textArea.addEventListener('input', () => {
      this.showStatus('Saving...', 'saving');
      this.debouncedSave();
    });

    // Theme toggle
    this.elements.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });

    // File upload
    this.elements.uploadBtn.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    this.elements.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop
    this.setupDragAndDrop();

    // Share functionality
    this.elements.copyBtn.addEventListener('click', () => {
      this.copyToClipboard(this.elements.shareUrl.value);
    });

    this.elements.qrBtn.addEventListener('click', () => {
      this.showQRCode();
    });

    this.elements.shareBtn.addEventListener('click', () => {
      this.showShareModal();
    });

    this.elements.newBoardBtn.addEventListener('click', () => {
      this.createNewBoard();
    });

    // Modal handling
    this.setupModalHandlers();

    // Close lightbox
    this.elements.lightboxClose.addEventListener('click', () => {
      this.elements.lightbox.classList.add('hidden');
    });

    this.elements.lightbox.addEventListener('click', (e) => {
      if (e.target === this.elements.lightbox) {
        this.elements.lightbox.classList.add('hidden');
      }
    });
  }

  setupDragAndDrop() {
    const dropZone = this.elements.dropZone;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleFiles(files);
    }, false);

    // Make entire dropzone clickable
    dropZone.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  setupModalHandlers() {
    // Share modal
    this.elements.shareCancel.addEventListener('click', () => {
      this.hideShareModal();
    });

    this.elements.shareConfirm.addEventListener('click', () => {
      this.createShareLink();
    });

    this.elements.shareCopy.addEventListener('click', () => {
      this.copyToClipboard(this.elements.shareResultInput.value);
    });

    // QR modal
    this.elements.qrClose.addEventListener('click', () => {
      this.hideQRModal();
    });

    // Close modals on backdrop click
    [this.elements.shareModal, this.elements.qrModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  async loadOrCreateBoard() {
    // Get board ID from URL path or query params
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    let boardId = null;

    // Check for path-based routing (e.g., /share/slug or /board123)
    if (path.startsWith('/share/')) {
      const slug = path.replace('/share/', '');

      if (this.mockMode) {
        // Mock mode: Look up from localStorage
        if (this.mockData.shareMap && this.mockData.shareMap[slug]) {
          boardId = this.mockData.shareMap[slug].boardId;
        } else {
          boardId = slug;
        }
      } else {
        // Real mode: Look up share mapping from blob storage
        try {
          const shareResponse = await fetch(`https://kw26seg4s0irkrho.public.blob.vercel-storage.com/shares/${slug}.json`);
          if (shareResponse.ok) {
            const shareData = await shareResponse.json();
            // Check if expired
            if (new Date() > new Date(shareData.expiresAt)) {
              this.showNotice('Share link has expired', 'error');
              await this.createNewBoard();
              return;
            }
            boardId = shareData.boardId;
          } else {
            // Share not found, use slug as board ID
            boardId = slug;
          }
        } catch (error) {
          console.error('Error loading share mapping:', error);
          boardId = slug;
        }
      }
    } else if (path !== '/' && path !== '') {
      // Handle direct board URLs like /board123
      boardId = path.substring(1); // Remove leading slash
    } else {
      // Check for query parameters as fallback
      boardId = urlParams.get('board') || urlParams.get('b');
    }

    if (boardId) {
      this.boardId = boardId;
      await this.loadBoard();
    } else {
      await this.createNewBoard();
    }

    this.updateUI();
  }

  async createNewBoard() {
    this.boardId = this.generateBoardId();
    const boardData = {
      id: this.boardId,
      text: '',
      media: [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    try {
      if (this.mockMode) {
        // Mock mode: save to localStorage
        this.mockData.boards[this.boardId] = boardData;
        this.saveMockStorage();
        this.updateURL();
        this.updateUI();
        this.populateBoard(boardData);
        this.showNotice('New board created! (demo)', 'success');
        return;
      }

      await this.saveBoard(boardData);
      this.updateURL();
      this.showNotice('New board created!', 'success');
    } catch (error) {
      console.error('Error creating board:', error);
      this.showNotice('Demo mode: Creating new board', 'info');
      // Fallback to mock mode
      this.mockMode = true;
      await this.createNewBoard();
    }
  }

  async loadBoard() {
    try {
      if (this.mockMode) {
        // Mock mode: use local storage
        const boardData = this.mockData.boards[this.boardId] || {
          id: this.boardId,
          text: '',
          media: [],
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
        this.populateBoard(boardData);
        this.showNotice('Board loaded (demo mode)', 'success');
        return;
      }

      const response = await fetch(`${this.apiBaseUrl}/boards/${this.boardId}`);

      if (response.ok) {
        const boardData = await response.json();
        this.populateBoard(boardData);
        this.showNotice('Board loaded', 'success');
      } else {
        this.showNotice('Board not found, creating new one', 'warning');
        await this.createNewBoard();
      }
    } catch (error) {
      console.error('Error loading board:', error);
      this.showNotice('Running in demo mode - API not available', 'info');
      // Fallback to mock mode
      this.mockMode = true;
      await this.loadBoard();
    }
  }

  populateBoard(boardData) {
    this.elements.textArea.value = boardData.text || '';
    this.renderGallery(boardData.media || []);
    this.showStatus('Loaded', 'success');
  }

  generateBoardId() {
    return Math.random().toString(36).substring(2, 10);
  }

  updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('board', this.boardId);
    window.history.replaceState({}, '', url);
  }

  updateUI() {
    const boardUrl = `${window.location.origin}${window.location.pathname}?board=${this.boardId}`;
    this.elements.shareUrl.value = boardUrl;
    this.elements.boardIdLabel.textContent = `Board: ${this.boardId}`;
  }

  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveBoardData();
    }, 1000);
  }

  async saveBoardData() {
    const boardData = {
      id: this.boardId,
      text: this.elements.textArea.value,
      lastModified: new Date().toISOString()
    };

    try {
      if (this.mockMode) {
        // Mock mode: save to localStorage
        if (!this.mockData.boards[this.boardId]) {
          this.mockData.boards[this.boardId] = {
            id: this.boardId,
            text: '',
            media: [],
            createdAt: new Date().toISOString()
          };
        }
        this.mockData.boards[this.boardId].text = boardData.text;
        this.mockData.boards[this.boardId].lastModified = boardData.lastModified;
        this.saveMockStorage();
        this.showStatus('Saved (demo)', 'success');
        return;
      }

      await this.saveBoard(boardData);
      this.showStatus('Saved', 'success');
    } catch (error) {
      console.error('Error saving board:', error);
      this.showStatus('Demo mode', 'info');
      // Fallback to mock mode
      this.mockMode = true;
      await this.saveBoardData();
    }
  }

  async saveBoard(boardData) {
    const response = await fetch(`${this.apiBaseUrl}/boards/${this.boardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(boardData),
    });

    if (!response.ok) {
      throw new Error('Failed to save board');
    }

    return response.json();
  }

  async handleFiles(files) {
    const fileArray = Array.from(files);
    this.showNotice(`Uploading ${fileArray.length} file(s)...`, 'info');

    for (const file of fileArray) {
      try {
        if (this.mockMode) {
          await this.mockUploadFile(file);
        } else {
          await this.uploadFile(file);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        this.showNotice(`Demo: File "${file.name}" added to gallery`, 'info');
        // In demo mode, still add mock file
        if (!this.mockMode) {
          this.mockMode = true;
          await this.mockUploadFile(file);
        }
      }
    }

    this.showNotice('Upload complete! (demo mode)', 'success');
    // Reload board to get updated media
    await this.loadBoard();
  }

  async mockUploadFile(file) {
    // Create mock file data using FileReader for preview
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const mediaItem = {
          id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: e.target.result, // Data URL for preview
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          isMock: true
        };

        // Add to mock board data
        if (!this.mockData.boards[this.boardId]) {
          this.mockData.boards[this.boardId] = {
            id: this.boardId,
            text: '',
            media: [],
            createdAt: new Date().toISOString()
          };
        }
        this.mockData.boards[this.boardId].media.push(mediaItem);
        this.saveMockStorage();

        resolve(mediaItem);
      };
      reader.readAsDataURL(file);
    });
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('boardId', this.boardId);

    const response = await fetch(`${this.apiBaseUrl}/media/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    return response.json();
  }

  renderGallery(mediaItems) {
    this.elements.gallery.innerHTML = '';

    mediaItems.forEach((item, index) => {
      const mediaElement = this.createMediaElement(item, index);
      this.elements.gallery.appendChild(mediaElement);
    });
  }

  createMediaElement(item, index) {
    const div = document.createElement('div');
    div.className = 'media-item';

    if (item.type?.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;
      img.loading = 'lazy';
      img.addEventListener('click', () => this.showLightbox(item));
      div.appendChild(img);
    } else if (item.type?.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = item.url;
      video.controls = false;
      video.muted = true;
      video.addEventListener('click', () => this.showLightbox(item));
      div.appendChild(video);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = '📄';
      icon.title = item.name;
      icon.addEventListener('click', () => window.open(item.url, '_blank'));
      div.appendChild(icon);
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete file';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteMedia(index);
    });
    div.appendChild(deleteBtn);

    return div;
  }

  showLightbox(item) {
    this.elements.lightboxImg.src = item.url;
    this.elements.lightboxImg.alt = item.name;
    this.elements.lightboxDownload.href = item.url;
    this.elements.lightboxDownload.download = item.name;
    this.elements.lightbox.classList.remove('hidden');
  }

  async deleteMedia(index) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/boards/${this.boardId}/media/${index}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await this.loadBoard();
        this.showNotice('File deleted', 'success');
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      this.showNotice('Error deleting file', 'error');
    }
  }

  showShareModal() {
    this.elements.shareModal.classList.remove('hidden');
    this.elements.shareResult.classList.add('hidden');
    this.elements.slugInput.value = '';
    this.elements.expirySelect.value = '86400';
  }

  hideShareModal() {
    this.elements.shareModal.classList.add('hidden');
  }

  async createShareLink() {
    const customSlug = this.elements.slugInput.value.trim();
    const expirySeconds = parseInt(this.elements.expirySelect.value);

    try {
      if (this.mockMode) {
        // Mock mode: create share mapping in localStorage
        const slug = customSlug || this.boardId;
        const shareUrl = `${window.location.origin}/share/${slug}`;

        // Store share mapping for later retrieval
        if (!this.mockData.shareMap) {
          this.mockData.shareMap = {};
        }
        this.mockData.shareMap[slug] = {
          boardId: this.boardId,
          createdAt: new Date().toISOString(),
          expirySeconds: expirySeconds
        };
        this.saveMockStorage();

        this.elements.shareResultInput.value = shareUrl;
        this.elements.shareResult.classList.remove('hidden');
        // Update the main link in header too
        this.elements.shareUrl.value = shareUrl;
        this.showNotice('Share link created!', 'success');
        return;
      }

      const response = await fetch(`${this.apiBaseUrl}/share/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId: this.boardId,
          customSlug,
          expirySeconds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const shareUrl = `${window.location.origin}/${result.slug}`;
        this.elements.shareResultInput.value = shareUrl;
        this.elements.shareResult.classList.remove('hidden');
        // Update the main link in header too
        this.elements.shareUrl.value = shareUrl;
        this.showNotice('Share link created!', 'success');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create share link');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      this.showNotice('Demo mode: Creating mock share link', 'info');
      // Fallback to mock mode
      this.mockMode = true;
      await this.createShareLink();
    }
  }

  async showQRCode() {
    try {
      const url = this.elements.shareUrl.value;
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      this.elements.qrCode.innerHTML = `<img src="${qrCodeDataURL}" alt="QR Code" style="border-radius: 8px;">`;
      this.elements.qrModal.classList.remove('hidden');
    } catch (error) {
      console.error('Error generating QR code:', error);
      this.showNotice('Error generating QR code', 'error');
    }
  }

  hideQRModal() {
    this.elements.qrModal.classList.add('hidden');
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotice('Copied to clipboard!', 'success');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotice('Copied to clipboard!', 'success');
    }
  }

  showStatus(message, type = 'success') {
    this.elements.saveStatus.textContent = message;
    this.elements.saveStatus.className = `status ${type}`;
  }

  showNotice(message, type = 'info') {
    this.elements.notice.textContent = message;
    this.elements.notice.className = `notice ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.notice.textContent = '';
      this.elements.notice.className = 'notice';
    }, 3000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SendFileLinkApp();
});
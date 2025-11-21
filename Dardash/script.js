// CONFIGURATION
// ⚠️ REPLACE THIS WITH YOUR OWN API KEY
const API_KEY = "AIzaSyAPNX3plLqJkE1r8jme7rB6nCFaGMyFFEg"; 

// Endpoints
const TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const themeToggle = document.getElementById("theme-toggle");
const welcomeMessage = document.querySelector(".welcome-message");
const micBtn = document.getElementById("mic-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarMenuBtn = document.getElementById("sidebar-menu-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn"); // NEW: Get close button
const newChatBtn = document.getElementById("new-chat-btn");
const chatList = document.getElementById("chat-list");

let abortController = null;
let currentChatId = null;
const CHAT_STORAGE_KEY = 'dardash-chats';

// --- 1. Theme Management (Auto-detect + localStorage) ---
const THEME_STORAGE_KEY = 'dardash-theme-preference';
const THEME_AUTO = 'auto';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

// Get system theme preference
const getSystemTheme = () => {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? THEME_DARK 
    : THEME_LIGHT;
};

// Apply theme to body
const applyTheme = (theme) => {
  const isLight = theme === THEME_LIGHT || (theme === THEME_AUTO && getSystemTheme() === THEME_LIGHT);
  
  if (isLight) {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  
  // Update icon
  const icon = themeToggle.querySelector("span");
  icon.innerText = isLight ? "dark_mode" : "light_mode";
};

// Get saved theme preference or default to 'auto'
const getSavedTheme = () => {
  return localStorage.getItem(THEME_STORAGE_KEY) || THEME_AUTO;
};

// Save theme preference
const saveTheme = (theme) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

// Initialize theme on page load
const initTheme = () => {
  const savedTheme = getSavedTheme();
  applyTheme(savedTheme);
};

// Handle manual theme toggle
const toggleTheme = () => {
  const savedTheme = getSavedTheme();
  let newTheme;
  
  // Cycle through: auto -> light -> dark -> auto
  if (savedTheme === THEME_AUTO) {
    newTheme = THEME_LIGHT;
  } else if (savedTheme === THEME_LIGHT) {
    newTheme = THEME_DARK;
  } else {
    newTheme = THEME_AUTO;
  }
  
  saveTheme(newTheme);
  applyTheme(newTheme);
};

// Listen for system theme changes (only when in auto mode)
const setupSystemThemeListener = () => {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const savedTheme = getSavedTheme();
      if (savedTheme === THEME_AUTO) {
        applyTheme(THEME_AUTO);
      }
    });
  }
};

// Initialize theme system
initTheme();
setupSystemThemeListener();

// Theme toggle button
themeToggle.addEventListener("click", toggleTheme);

// --- 2. Voice Input Logic (Web Speech API) ---
const setupVoiceInput = () => {
  // NOTE: We cannot use alert() here, but since this is setup code, we'll keep the
  // check but remove the alert.
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn("Voice input is not supported in this browser.");
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    if (micBtn.classList.contains("active")) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  recognition.onstart = () => {
    micBtn.classList.add("active");
    chatInput.placeholder = "Listening...";
  };

  recognition.onend = () => {
    micBtn.classList.remove("active");
    chatInput.placeholder = "Ask me anything...";
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    micBtn.classList.remove("active");
    chatInput.placeholder = "Ask me anything...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
  };
};
setupVoiceInput();

// --- 3. Helper Functions ---
// Format timestamp (e.g., "Delivered 12:41 PM")
const formatTimestamp = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

// Create message element with timestamp and actions
const createMessageElement = (content, className, addTimestamp = true) => {
  const div = document.createElement("div");
  div.classList.add("message", className);
  
  // Build message actions
  let actionsHTML = `
    <div class="message-actions">
      <button class="message-action-btn" title="Copy message" data-action="copy">
        <span class="material-symbols-rounded">content_copy</span>
      </button>`;
  
  // Add regenerate button only for bot messages
  if (className === 'bot') {
    actionsHTML += `
      <button class="message-action-btn" title="Regenerate response" data-action="regenerate">
        <span class="material-symbols-rounded">refresh</span>
      </button>`;
  }
  
  actionsHTML += `
      <button class="message-action-btn" title="Delete message" data-action="delete">
        <span class="material-symbols-rounded">delete</span>
      </button>
    </div>`;
  
  // Wrap content with wrapper and insert actions
  let messageHTML = `<div class="message-content-wrapper">
    ${content}
    ${actionsHTML}
  </div>`;
  
  if (addTimestamp) {
    const timestamp = formatTimestamp();
    const timestampHTML = `<div class="message-timestamp">Delivered ${timestamp}</div>`;
    
    // For user messages, add seen indicator container
    if (className === 'user') {
      messageHTML += `<div class="message-status">
        ${timestampHTML}
        <span class="seen-indicator" style="display: none;">Seen</span>
      </div>`;
    } else {
      // For bot messages, just add timestamp
      messageHTML += timestampHTML;
    }
  }
  
  div.innerHTML = messageHTML;
  
  // Attach event listeners to action buttons
  attachMessageActions(div, className);
  
  return div;
};

// Mark user message as seen
const markMessageAsSeen = (userMessageDiv) => {
  const seenIndicator = userMessageDiv.querySelector('.seen-indicator');
  if (seenIndicator) {
    seenIndicator.style.display = 'inline';
  }
};

// Attach message action event listeners
const attachMessageActions = (messageDiv, className) => {
  const actionButtons = messageDiv.querySelectorAll('.message-action-btn');
  
  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      
      switch(action) {
        case 'copy':
          copyMessage(messageDiv);
          break;
        case 'regenerate':
          regenerateMessage(messageDiv);
          break;
        case 'delete':
          deleteMessage(messageDiv);
          break;
      }
    });
  });
};

// Copy message text to clipboard
const copyMessage = async (messageDiv) => {
  const textDiv = messageDiv.querySelector('.text');
  if (!textDiv) return;
  
  // Get plain text content (remove HTML tags)
  const textContent = textDiv.innerText || textDiv.textContent;
  
  try {
    await navigator.clipboard.writeText(textContent);
    
    // Show feedback
    const copyBtn = messageDiv.querySelector('[data-action="copy"]');
    const originalIcon = copyBtn.querySelector('span');
    const originalText = originalIcon.textContent;
    
    originalIcon.textContent = 'check';
    copyBtn.style.color = '#4b90ff';
    
    setTimeout(() => {
      originalIcon.textContent = originalText;
      copyBtn.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
};

// Regenerate bot response
const regenerateMessage = async (messageDiv) => {
  // Find the user message that prompted this response
  const allMessages = Array.from(chatBox.querySelectorAll('.message'));
  const currentIndex = allMessages.indexOf(messageDiv);
  
  if (currentIndex === -1 || currentIndex === 0) return;
  
  // Find the user message before this bot response
  let userMessageDiv = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (allMessages[i].classList.contains('user')) {
      userMessageDiv = allMessages[i];
      break;
    }
  }
  
  if (!userMessageDiv) return;
  
  const userText = userMessageDiv.querySelector('.text')?.innerText || userMessageDiv.querySelector('.text')?.textContent;
  if (!userText) return;
  
  // Remove old bot response
  deleteMessage(messageDiv);
  
  // Create new bot message with loading
  const botDiv = showLoadingAnimation();
  
  // Generate new response
  generateTextResponse(userText, botDiv);
};

// Delete message
const deleteMessage = (messageDiv) => {
  // Add fade out animation
  messageDiv.style.opacity = '0';
  messageDiv.style.transform = 'translateY(-10px)';
  messageDiv.style.transition = 'all 0.3s ease-out';
  
  setTimeout(() => {
    messageDiv.remove();
    
    // If no messages left, show welcome screen
    if (chatBox.children.length === 0) {
      welcomeMessage.style.display = 'block';
      chatBox.style.display = 'none';
    }
  }, 300);
};

const showLoadingAnimation = () => {
  const botHTML = `
    <div class="message-avatar">🤖</div>
    <div class="text">
      <div class="loading-indicator">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    </div>`;
  const botDiv = createMessageElement(botHTML, "bot", false); // No timestamp while loading
  chatBox.appendChild(botDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  return botDiv;
};

// Delay function for Exponential Backoff
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- 4. Text Chat Logic (Streaming) ---
const generateTextResponse = async (userText, botDiv) => {
  // Ensure avatar is present
  if (!botDiv.querySelector(".message-avatar")) {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "🤖";
    botDiv.insertBefore(avatar, botDiv.firstChild);
  }
  
  const textDiv = botDiv.querySelector(".text");
  textDiv.innerHTML = ""; // Clear loading

  try {
    abortController = new AbortController();
    const signal = abortController.signal;

    const contents = [
      {
        parts: [
          { text: userText }
        ]
      }
    ];

    const response = await fetch(TEXT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
      signal: signal
    });

    if (!response.ok) throw new Error("API Error");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      lines.forEach(line => {
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);
            const textSnippet = data.candidates[0].content.parts[0].text;
            if (textSnippet) {
              // Basic Markdown to HTML conversion
              textDiv.innerHTML += textSnippet.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
              chatBox.scrollTop = chatBox.scrollHeight;
            }
          } catch (e) { }
        }
      });
    }
    
    // Add timestamp after response is complete
    const timestamp = formatTimestamp();
    const timestampDiv = document.createElement("div");
    timestampDiv.className = "message-timestamp";
    timestampDiv.textContent = `Delivered ${timestamp}`;
    botDiv.appendChild(timestampDiv);
  } catch (error) {
    if (error.name !== 'AbortError') textDiv.innerHTML = "Error: Could not connect to Dardash.";
    
    // Add timestamp even on error
    const timestamp = formatTimestamp();
    const timestampDiv = document.createElement("div");
    timestampDiv.className = "message-timestamp";
    timestampDiv.textContent = `Delivered ${timestamp}`;
    botDiv.appendChild(timestampDiv);
    throw error; // Re-throw to handle in caller
  } finally {
    abortController = null;
  }
};

// --- 5. Chat Management (localStorage) ---
const getChats = () => {
  const chats = localStorage.getItem(CHAT_STORAGE_KEY);
  return chats ? JSON.parse(chats) : [];
};

const saveChats = (chats) => {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
};

const createNewChat = () => {
  const chatId = Date.now().toString();
  const newChat = {
    id: chatId,
    title: 'New Chat',
    messages: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const chats = getChats();
  chats.unshift(newChat); // Add to beginning
  saveChats(chats);
  
  currentChatId = chatId;
  loadChat(chatId);
  renderChatList();
  clearChatBox();
  
  return newChat;
};

const saveCurrentChat = () => {
  if (!currentChatId) return;
  
  const messages = Array.from(chatBox.querySelectorAll('.message')).map(msg => {
    const textDiv = msg.querySelector('.text');
    const timestamp = msg.querySelector('.message-timestamp')?.textContent || '';
    const isUser = msg.classList.contains('user');
    
    return {
      text: textDiv ? (textDiv.innerText || textDiv.textContent) : '',
      isUser,
      timestamp,
      html: msg.outerHTML
    };
  });
  
  const chats = getChats();
  const chatIndex = chats.findIndex(c => c.id === currentChatId);
  
  if (chatIndex !== -1) {
    chats[chatIndex].messages = messages;
    chats[chatIndex].updatedAt = Date.now();
    
    // Update title from first user message if title is still "New Chat"
    if (chats[chatIndex].title === 'New Chat') {
      const firstUserMessage = messages.find(m => m.isUser);
      if (firstUserMessage && firstUserMessage.text) {
        chats[chatIndex].title = firstUserMessage.text.substring(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '');
      }
    }
    
    saveChats(chats);
    renderChatList();
  }
};

const loadChat = (chatId) => {
  const chats = getChats();
  const chat = chats.find(c => c.id === chatId);
  
  if (!chat) return;
  
  currentChatId = chatId;
  chatBox.innerHTML = '';
  
  // Load messages from storage
  if (chat.messages && chat.messages.length > 0) {
    chatBox.style.display = 'flex';
    chatBox.style.justifyContent = 'flex-start';
    welcomeMessage.style.display = 'none';
    
    chat.messages.forEach(msg => {
      const div = document.createElement('div');
      div.innerHTML = msg.html;
      const messageDiv = div.firstElementChild;
      chatBox.appendChild(messageDiv);
      
      // Reattach event listeners
      if (messageDiv.classList.contains('user')) {
        attachMessageActions(messageDiv, 'user');
      } else if (messageDiv.classList.contains('bot')) {
        attachMessageActions(messageDiv, 'bot');
      }
    });
    
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    welcomeMessage.style.display = 'block';
    chatBox.style.display = 'none';
  }
  
  renderChatList();
};

const deleteChat = (chatId) => {
  if (confirm('Are you sure you want to delete this chat?')) {
    const chats = getChats();
    const filteredChats = chats.filter(c => c.id !== chatId);
    saveChats(filteredChats);
    
    if (currentChatId === chatId) {
      currentChatId = null;
      clearChatBox();
      welcomeMessage.style.display = 'block';
      chatBox.style.display = 'none';
    }
    
    renderChatList();
  }
};

const renameChat = (chatId, newTitle) => {
  const chats = getChats();
  const chatIndex = chats.findIndex(c => c.id === chatId);
  
  if (chatIndex !== -1) {
    chats[chatIndex].title = newTitle.trim() || 'New Chat';
    chats[chatIndex].updatedAt = Date.now();
    saveChats(chats);
    renderChatList();
  }
};

const togglePinChat = (chatId) => {
  const chats = getChats();
  const chatIndex = chats.findIndex(c => c.id === chatId);
  
  if (chatIndex !== -1) {
    chats[chatIndex].pinned = !chats[chatIndex].pinned;
    chats[chatIndex].updatedAt = Date.now();
    
    // Sort: pinned first, then by updatedAt
    chats.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
    
    saveChats(chats);
    renderChatList();
  }
};

const renderChatList = () => {
  const chats = getChats();
  chatList.innerHTML = '';
  
  chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}`;
    chatItem.dataset.chatId = chat.id;
    
    const title = chat.title || 'New Chat';
    
    chatItem.innerHTML = `
      <div class="chat-item-content">
        <button class="chat-item-pin ${chat.pinned ? 'pinned' : ''}" data-action="pin" title="${chat.pinned ? 'Unpin' : 'Pin'}">
          <span class="material-symbols-rounded">push_pin</span>
        </button>
        <span class="chat-item-title">${title}</span>
      </div>
      <div class="chat-item-actions">
        <button class="chat-item-action" data-action="rename" title="Rename">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="chat-item-action" data-action="delete" title="Delete">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    `;
    
    // Click to load chat
    chatItem.addEventListener('click', (e) => {
      if (!e.target.closest('.chat-item-action') && !e.target.closest('.chat-item-pin')) {
        loadChat(chat.id);
        closeSidebar(); // Close on mobile after selection
      }
    });
    
    // Pin toggle
    const pinBtn = chatItem.querySelector('[data-action="pin"]');
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePinChat(chat.id);
    });
    
    // Rename
    const renameBtn = chatItem.querySelector('[data-action="rename"]');
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const titleSpan = chatItem.querySelector('.chat-item-title');
      const currentTitle = titleSpan.textContent;
      titleSpan.contentEditable = true;
      titleSpan.classList.add('editing');
      titleSpan.focus();
      
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(titleSpan);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      const finishRename = () => {
        titleSpan.contentEditable = false;
        titleSpan.classList.remove('editing');
        const newTitle = titleSpan.textContent.trim() || 'New Chat';
        renameChat(chat.id, newTitle);
      };
      
      titleSpan.addEventListener('blur', finishRename, { once: true });
      titleSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          titleSpan.textContent = currentTitle;
          finishRename();
        }
      });
    });
    
    // Delete
    const deleteBtn = chatItem.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    
    chatList.appendChild(chatItem);
  });
};

const clearChatBox = () => {
  chatBox.innerHTML = '';
  chatBox.style.display = 'none';
  welcomeMessage.style.display = 'block';
};

// Sidebar toggle functions
const openSidebar = () => {
  sidebar.classList.add('open');
  sidebar.classList.remove('collapsed'); // NEW: Ensure collapsed state is removed when opening
  sidebarOverlay.classList.add('active');
};

const closeSidebar = () => {
  sidebar.classList.remove('open');
  sidebar.classList.add('collapsed'); // NEW: Add collapsed state for desktop
  sidebarOverlay.classList.remove('active');
};

// --- 6. Main Handle Function ---
const handleChat = () => {
  const userText = chatInput.value.trim();
  if (!userText) return;

  // Create new chat if none exists
  if (!currentChatId) {
    createNewChat();
  }

  // UI Updates
  welcomeMessage.style.display = "none";
  chatBox.style.display = "flex";
  chatBox.style.justifyContent = "flex-start";

  // Add User Message
  const userDiv = createMessageElement(`<div class="text">${userText}</div>`, "user");
  chatBox.appendChild(userDiv);
  chatInput.value = "";

  // Add Bot Loading State
  const botDiv = showLoadingAnimation();

  // Mark user message as seen when bot starts typing (after a short delay)
  setTimeout(() => {
    markMessageAsSeen(userDiv);
  }, 500);

  // Generate response and save chat
  generateTextResponse(userText, botDiv).then(() => {
    saveCurrentChat();
  }).catch(() => {
    saveCurrentChat(); // Save even on error
  });
};

// --- 7. Event Listeners ---
sendBtn.addEventListener("click", () => handleChat());

// New chat button
newChatBtn.addEventListener("click", () => {
  createNewChat();
  closeSidebar();
});

// Sidebar toggle (for mobile menu button)
sidebarMenuBtn.addEventListener("click", () => {
  openSidebar();
});

// Sidebar close button (for desktop/manual close)
sidebarCloseBtn.addEventListener("click", () => { // NEW
  closeSidebar();
});

sidebarOverlay.addEventListener("click", () => {
  closeSidebar();
});

// Initialize
renderChatList();

// Save chat periodically while chatting
setInterval(() => {
  if (currentChatId && chatBox.children.length > 0) {
    saveCurrentChat();
  }
}, 5000); // Save every 5 seconds

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleChat();
  }
});

// Suggestion cards
window.fillInput = (text) => {
  chatInput.value = text;
  handleChat();
};
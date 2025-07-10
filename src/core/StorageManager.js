const fs = require('fs').promises;
const path = require('path');

class StorageManager {
  constructor(config) {
    this.config = config;
    this.dataDir = config.dataDir;
    this.contactsPath = path.join(this.dataDir, config.contactsFile);
    this.messagesPath = path.join(this.dataDir, config.messagesFile);
    this.identityPath = path.join(this.dataDir, config.identityFile);
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      await this.ensureDataDirectory();
      await this.initializeFiles();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`);
    }
  }

  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.dataDir, { recursive: true });
        console.log(`📁 Created data directory: ${this.dataDir}`);
      } else {
        throw error;
      }
    }
  }

  async initializeFiles() {
    const files = [
      { path: this.contactsPath, defaultData: { contacts: [] } },
      { path: this.messagesPath, defaultData: { messages: [] } },
      { path: this.identityPath, defaultData: null }
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch (error) {
        if (error.code === 'ENOENT' && file.defaultData !== null) {
          await this.writeJsonFile(file.path, file.defaultData);
        }
      }
    }
  }

  async readJsonFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read ${filePath}: ${error.message}`);
    }
  }

  async writeJsonFile(filePath, data) {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write ${filePath}: ${error.message}`);
    }
  }

  async loadContacts() {
    const data = await this.readJsonFile(this.contactsPath);
    return data ? data.contacts : [];
  }

  async saveContact(contact) {
    const contacts = await this.loadContacts();
    
    // Check if contact already exists
    const existingIndex = contacts.findIndex(c => c.id === contact.id);
    
    if (existingIndex >= 0) {
      contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
    } else {
      contacts.push({
        id: contact.id || require('uuid').v4(),
        name: contact.name,
        address: contact.address,
        publicKey: contact.publicKey,
        dateAdded: Date.now(),
        lastSeen: Date.now()
      });
    }

    await this.writeJsonFile(this.contactsPath, { contacts });
  }

  async removeContact(contactId) {
    const contacts = await this.loadContacts();
    const filteredContacts = contacts.filter(c => c.id !== contactId);
    await this.writeJsonFile(this.contactsPath, { contacts: filteredContacts });
  }

  async loadMessages(contactId = null) {
    const data = await this.readJsonFile(this.messagesPath);
    const messages = data ? data.messages : [];
    
    if (contactId) {
      return messages.filter(msg => 
        msg.from === contactId || msg.to === contactId
      );
    }
    
    return messages;
  }

  async saveMessage(message) {
    const messages = await this.loadMessages();
    
    // Add message with metadata
    const messageWithMetadata = {
      id: message.id || require('uuid').v4(),
      from: message.from,
      to: message.to,
      text: message.text,
      timestamp: message.timestamp || Date.now(),
      encrypted: message.encrypted || false,
      delivered: message.delivered || false,
      read: message.read || false
    };

    messages.push(messageWithMetadata);
    
    // Keep only recent messages (based on config)
    const maxMessages = this.config.maxMessageHistory || 1000;
    if (messages.length > maxMessages) {
      messages.splice(0, messages.length - maxMessages);
    }

    await this.writeJsonFile(this.messagesPath, { messages });
  }

  async markMessageAsRead(messageId) {
    const messages = await this.loadMessages();
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex >= 0) {
      messages[messageIndex].read = true;
      await this.writeJsonFile(this.messagesPath, { messages });
    }
  }

  async loadIdentity() {
    return await this.readJsonFile(this.identityPath);
  }

  async saveIdentity(identity) {
    await this.writeJsonFile(this.identityPath, identity);
  }

  async getChatHistory(contactId) {
    const messages = await this.loadMessages(contactId);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getContactStats(contactId) {
    const messages = await this.loadMessages(contactId);
    const sent = messages.filter(msg => msg.from !== contactId).length;
    const received = messages.filter(msg => msg.from === contactId).length;
    
    return {
      totalMessages: messages.length,
      sent,
      received,
      lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
    };
  }

  async searchMessages(query, contactId = null) {
    const messages = await this.loadMessages(contactId);
    const searchTerm = query.toLowerCase();
    
    return messages.filter(msg =>
      msg.text.toLowerCase().includes(searchTerm)
    );
  }

  async exportData() {
    const contacts = await this.loadContacts();
    const messages = await this.loadMessages();
    const identity = await this.loadIdentity();
    
    return {
      contacts,
      messages,
      identity: identity ? { ...identity, privateKey: '[REDACTED]' } : null,
      exportDate: new Date().toISOString()
    };
  }

  async importData(data) {
    if (data.contacts) {
      await this.writeJsonFile(this.contactsPath, { contacts: data.contacts });
    }
    
    if (data.messages) {
      await this.writeJsonFile(this.messagesPath, { messages: data.messages });
    }
    
    // Note: Identity is not imported for security reasons
  }

  async clearAllData() {
    const emptyContacts = { contacts: [] };
    const emptyMessages = { messages: [] };
    
    await this.writeJsonFile(this.contactsPath, emptyContacts);
    await this.writeJsonFile(this.messagesPath, emptyMessages);
  }

  async getStorageStats() {
    const contacts = await this.loadContacts();
    const messages = await this.loadMessages();
    
    return {
      totalContacts: contacts.length,
      totalMessages: messages.length,
      dataDirectory: this.dataDir,
      lastUpdated: Date.now()
    };
  }
}

module.exports = StorageManager;
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import messages from '../services/messages';

const ChatScreen = ({ route, navigation }) => {
  const { conversationId, otherUserName } = route.params;
  const [messageList, setMessageList] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  
  // TODO: Get from auth context
  const userId = 'demo-user-id';

  useEffect(() => {
    loadMessages();
    markRead();
  }, [conversationId]);

  const loadMessages = async () => {
    try {
      const data = await messages.getMessages(conversationId);
      setMessageList(data.messages || []);
    } catch (err) {
      console.log('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async () => {
    try {
      await messages.markAsRead(conversationId, userId);
    } catch (err) {
      console.log('Failed to mark as read:', err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const text = inputText.trim();
    setInputText('');
    
    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      senderId: userId,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessageList(prev => [...prev, tempMessage]);
    
    try {
      const { message } = await messages.sendMessage(conversationId, userId, text);
      // Replace temp with real message
      setMessageList(prev => 
        prev.map(m => m.id === tempMessage.id ? message : m)
      );
    } catch (err) {
      console.log('Failed to send:', err);
      // Remove temp message on error
      setMessageList(prev => prev.filter(m => m.id !== tempMessage.id));
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === userId;
    
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUserName || 'Chat'}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messageList}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerRight: {
    width: 32,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default ChatScreen;

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, TextInput, StyleSheet, Keyboard } from 'react-native';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const SearchBar = memo(({ onSearch, initialValue = '' }) => {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef(null);
  
  // Debounce the search - wait 500ms after user stops typing
  const debouncedText = useDebounce(text, 500);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debouncedText);
  }, [debouncedText, onSearch]);

  const handleSubmit = () => {
    // Immediate search on submit (bypass debounce)
    onSearch(text);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search events, venues, artists..."
        placeholderTextColor="#999"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default SearchBar;

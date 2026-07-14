import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import api from '../api/api';

export default function GithubUserAutocomplete({
  value,
  onChange,
  placeholder = 'Nhập github-username...',
  disabled = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);



  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/github-repositories/search-users?q=${encodeURIComponent(value.trim())}`);
        setSuggestions(res.data || []);
        setIsOpen(res.data && res.data.length > 0);
      } catch (err) {
        console.error('Failed to search github users:', err);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [value]);

  const handleSelect = (username) => {
    onChange(username);
    setIsOpen(false);
  };



  return (
    <View style={[styles.container, isOpen && suggestions.length > 0 && { height: 200, marginBottom: -140, zIndex: 100 }]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, disabled && styles.disabledInput]}
          placeholder={placeholder}
          placeholderTextColor="#849495"
          value={value}
          onChangeText={(text) => {
            onChange(text);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value && value.trim().length >= 2 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#00f0ff" />
          </View>
        )}
      </View>

      {isOpen && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            style={styles.list}
            bounces={false}
            overScrollMode="never"
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.username}
                style={styles.item}
                onPress={() => handleSelect(item.username)}
              >
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                <Text style={styles.username}>{item.username}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 50,
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 4,
  },
  inputTrigger: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    justifyContent: 'center',
  },
  triggerText: {
    color: '#dae3f0',
    fontSize: 14,
  },
  placeholderText: {
    color: '#849495',
  },
  disabledInput: {
    opacity: 0.5,
  },
  loader: {
    position: 'absolute',
    right: 12,
  },
  dropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    borderRadius: 4,
    maxHeight: 160,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  list: {
    padding: 4,
    maxHeight: 150,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3b494b',
  },
  username: {
    color: '#dae3f0',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#849495',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

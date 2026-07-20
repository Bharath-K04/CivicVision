// components/ChatBubble.js
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, useTheme, Surface } from 'react-native-paper';

export default function ChatBubble({ from, text, type, uri }) {
  const isUser = from === 'user';
  const theme = useTheme();

  return (
    <View style={[styles.container, isUser ? styles.alignRight : styles.alignLeft]}>
  <View style={styles.row}>
    {!isUser && <Text style={styles.icon}>🤖</Text>}
    <Surface style={[styles.bubble, { backgroundColor: isUser ? '#d6b3f7' : '#e0e0e0' }]}>
      {type === 'image' ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={{ color: isUser ? '#fff' : '#000' }}>{text}</Text>
      )}
    </Surface>
    {isUser && <Text style={styles.icon}>🙋‍♂️</Text>}
  </View>
</View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
icon: { fontSize: 18, marginHorizontal: 6 },
image: { width: 150, height: 150, borderRadius: 10 },
});

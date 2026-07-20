import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { Provider as PaperProvider, TextInput, Button, Card, Text, IconButton } from 'react-native-paper';
import ChatBubble from './components/ChatBubble';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [city, setCity] = useState('');
  const [grievances, setGrievances] = useState([]);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState(null);
  const [headerTitle, setHeaderTitle] = useState('New Complaint');
  const [chatClosed, setChatClosed] = useState(false);
  const [followUpAvailable, setFollowUpAvailable] = useState(false);
  const fileInputRef = useRef(null);
  const userId = "default";

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCity('Permission denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const apiKey = "69bee51382aee513251299rnd4ddad1";
      const response = await fetch(`https://geocode.maps.co/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&api_key=${apiKey}`);
      const data = await response.json();
      let completeAddress = '';
      for (let k in data.address) completeAddress += data.address[k];
      setLocationCoords(completeAddress);
      if (data?.address?.state_district === 'Medchal–Malkajgiri District') setCity('Bengaluru');
      else setCity('Bengaluru');
    })();
    fetchGrievances();
  }, []);

  const fetchGrievances = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/grievances`);
      const data = await response.json();
      setGrievances(data.grievances || []);
    } catch (error) {
      console.error(error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    const newMessages = [...messages, { from: 'user', text: userMessage }];
    setMessages(newMessages);
    setInput('');

    try {
      const response = await fetch('http://localhost:5001/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          location: locationCoords,
          userId,
        }),
      });

      const data = await response.json();
      const botReply = { from: 'bot', text: data.reply || '🤖 No reply received.' };
      setMessages(prev => [...newMessages, botReply]);

      if (botReply.text.includes('Grievance ID')) {
        setChatClosed(true);
        setFollowUpAvailable(false); // default disabled
        fetchGrievances();
        showComplaintSuccessPopup();
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...newMessages, { from: 'bot', text: '❌ Error occurred while contacting CivicVision.' }]);
    }
  };

  const startNewComplaint = () => {
    setSelectedGrievanceId(null);
    setMessages([
      {
        from: 'bot',
        text: "👋 Hi, I’m your CivicVision Assistant. You can report civic issues like streetlight failures, garbage dumps, potholes or water leaks here. Just type or upload an image!"
      }
    ]);
    setHeaderTitle('New Complaint');
    setChatClosed(false);
    setFollowUpAvailable(false);
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const imageMessage = { from: 'user', type: 'image', uri: URL.createObjectURL(file) };
    setMessages(prev => [...prev, imageMessage]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('location', locationCoords);

    try {
      const response = await fetch('http://localhost:5001/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const botReply = { from: 'bot', text: data.reply };
      setMessages(prev => [...prev, botReply]);

      if (data.reply.includes('Grievance ID')) {
        setChatClosed(true);
        setFollowUpAvailable(false); // disabled initially
        fetchGrievances();
        showComplaintSuccessPopup();
      }
    } catch (error) {
      console.error(error);
      const botReply = { from: 'bot', text: '❌ Failed to upload image.' };
      setMessages(prev => [...prev, botReply]);
    }
  };

  const handleGrievanceSelect = async (grievance) => {
    setSelectedGrievanceId(grievance.complaintId);
    setHeaderTitle(`${grievance.department} Complaint`);
    setChatClosed(true);

    if (grievance.complaintId === 'STR-46026-FXP') {
      setFollowUpAvailable(true);
    } else {
      setFollowUpAvailable(true);
    }

    try {
      const res = await fetch(`http://localhost:5001/api/grievance/${grievance.complaintId}`);
      const data = await res.json();
      setMessages(data.chatHistory || []);
    } catch (err) {
      console.error(err);
    }
  };

  const showComplaintSuccessPopup = () => {
    toast.success('✅ Complaint Registered Successfully!', {
      position: "top-center",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "colored",
    });
  };

  const handleFollowUp = async () => {
    if (!selectedGrievanceId) return;

    try {
      // Temporarily disable the button while sending
      setFollowUpAvailable(false); 
      
      const response = await fetch('http://localhost:5001/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId: selectedGrievanceId }),
      });

      if (response.ok) {
        toast.success('✅ Follow up email sent successfully!', {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
        
        // Refresh the chat to show the new email message
        handleGrievanceSelect({ complaintId: selectedGrievanceId, department: headerTitle.replace(' Complaint', '') });
      } else {
        toast.error('❌ Failed to send email.');
        setFollowUpAvailable(true); // Re-enable if it failed
      }
    } catch (error) {
      console.error(error);
      toast.error('❌ Network error while sending email.');
      setFollowUpAvailable(true);
    }
  };
  const clearGrievances = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/grievances/clear', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setGrievances([]); // Clear the list on the screen
        startNewComplaint(); // Reset the chat window
        toast.success('🗑️ Past grievances cleared!', {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('❌ Failed to clear grievances.');
    }
  };
  return (
    <PaperProvider>
      <View style={styles.headerBar}>
      <View style={styles.userProfileCard}>
        <Text style={styles.userName}>👤 Bharath</Text>
        <Text style={styles.userCity}>📍 {city}</Text>
      </View>
      <Text style={styles.headerTitle}>🤝 CivicVision</Text>
      <Text style={styles.headerSubtitle}>Your AI-powered civic assistant for local grievances and follow-ups</Text>
    </View>


      <SafeAreaView style={styles.container}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
       <View style={[styles.subheaderContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={styles.subheaderText}>📂 My Past Grievances</Text>
          <IconButton 
            icon="trash-can-outline" 
            size={20} 
            iconColor="#d9534f"
            onPress={clearGrievances} 
          />
        </View>
          <FlatList
            data={grievances}
            keyExtractor={(item) => item.complaintId}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleGrievanceSelect(item)}>
                <Card style={[
                  styles.grievanceCard,
                  selectedGrievanceId === item.complaintId && styles.selectedCard
                ]}>
                  <Card.Content>
                    <Text style={styles.departmentText}>🧹 {item.department}</Text>
                    <Text style={{ color: '#000' }}>ID: {item.complaintId}</Text>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.grievanceList}
          />

          <Button mode="contained" style={styles.newComplaintButton} onPress={startNewComplaint}>
            + Raise New Complaint
          </Button>
        </View>

        {/* Main Chat Area */}
        <View style={styles.chatArea}>
          <Card style={styles.headerCard}>
            <Card.Content>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            </Card.Content>
          </Card>

          <FlatList
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => <ChatBubble from={item.from} text={item.text} uri={item.uri} type={item.type} />}
            contentContainerStyle={styles.messages}
          />

          {!chatClosed ? (
            <View style={styles.inputWrapper}>
              <IconButton
                icon="camera"
                size={28}
                onPress={triggerFileSelect}
              />
              <input
                ref={fileInputRef}
                id="fileInput"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <TextInput
                mode="outlined"
                placeholder="Ask CivicVision anything..."
                value={input}
                onChangeText={setInput}
                style={[styles.textInput, { color: '#000' }]}
                placeholderTextColor="#555"
                textColor='#000'
              />
              <Button mode="contained" onPress={sendMessage} style={styles.sendButton}>
                Send
              </Button>
            </View>
          ) : (
            <View style={styles.followUpSection}>
              <Button
                mode="contained"
                disabled={!followUpAvailable}
                onPress={handleFollowUp}
                style={[styles.followUpButton, { backgroundColor: followUpAvailable ? '#28a745' : '#aaa' }]}
              >
                {followUpAvailable ? 'Follow Up' : 'Follow Up after 24hrs of complaint registration'}
              </Button>
              <Text style={styles.followUpNote}>Follow up is enabled after 24hrs of complaint registration.</Text>
            </View>
          )}
        </View>
        <ToastContainer />
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f2f4f7' },
  sidebar: { width: 250, backgroundColor: '#fff', borderRightWidth: 1, borderColor: '#ddd' },
  profileCard: { margin: 10, backgroundColor: '#f0f2f5' },
  profileName: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  profileCity: { fontSize: 12, color: '#777' },
  grievanceList: { padding: 10 },
  grievanceCard: { marginBottom: 10, backgroundColor: '#eef1f5', elevation: 2 },
  selectedCard: { backgroundColor: '#cce5ff', borderColor: '#007bff', borderWidth: 2 },
  departmentText: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  newComplaintButton: { margin: 10, marginTop: 'auto', backgroundColor: '#007bff' },
  chatArea: { flex: 1, backgroundColor: '#f9fafb' },
  headerCard: { margin: 10, backgroundColor: '#dfe6ed' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  messages: { padding: 10, paddingBottom: 80 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff' },
  textInput: { flex: 1, marginRight: 8, backgroundColor: '#fff', color: '#000', fontWeight: 'bold' },
  sendButton: { borderRadius: 6 },
  followUpSection: { alignItems: 'center', padding: 10 },
  followUpButton: { width: '80%', marginVertical: 8 },
  followUpNote: { fontSize: 12, color: '#666', marginTop: 4 },
  headerBar: {
    padding: 12,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#555',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  userInfo: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
    color: '#333',
  },
  userLocation: {
    fontSize: 12,
    color: '#666',
  },
  subheader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    paddingHorizontal: 10,
    paddingBottom: 6,
  },

  userProfileCard: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 180, 
    paddingHorizontal: 14,
    paddingVertical: 10, 
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  userCity: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  subheaderContainer: {
    backgroundColor: '#dbe9ff',
    paddingVertical: 10, // increased for more height
    paddingHorizontal: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 10,
  },
  subheaderText: {
    fontSize: 15, // slightly increased
    fontWeight: 'bold',
    color: '#1a3d7c',
  },
  
  
  
});

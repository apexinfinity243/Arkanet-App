import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Modal,
  ActivityIndicator, Alert, Dimensions, Animated,
  TouchableWithoutFeedback, Keyboard
} from 'react-native';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, getDoc, getDocs,
  serverTimestamp, setDoc
} from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebase';

const GREEN = '#00ff41';
const GREEN_DIM = '#00b32c';
const RED = '#ff3a3a';
const BLUE = '#00cfff';
const { width } = Dimensions.get('window');

/* ── HELPER ── */
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  if (d.toDateString() === today.toDateString()) return "AUJOURD'HUI";
  if (d.toDateString() === yesterday.toDateString()) return 'HIER';
  return d.toLocaleDateString('fr-FR');
}
function getInitials(user) {
  return ((user?.prenom?.[0]||'')+(user?.nom?.[0]||'')).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
}
function getFullName(user) {
  return ((user?.prenom||'')+' '+(user?.nom||'')).trim().toUpperCase() || user?.email?.toUpperCase() || 'INCONNU';
}

/* ══════════════════════════════════════════════════
   CHAT SCREEN
══════════════════════════════════════════════════ */
export default function ChatScreen() {
  const me = auth.currentUser;
  const [myData, setMyData]           = useState(null);
  const [conversations, setConvs]     = useState([]);
  const [activeConv, setActiveConv]   = useState(null);
  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState('');
  const [replyTo, setReplyTo]         = useState(null);
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQ, setSearchQ]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  const flatRef = useRef();
  const unsubMsgs = useRef(null);
  const unsubConvs = useRef(null);

  // Load my profile
  useEffect(() => {
    if (!me) return;
    getDoc(doc(db,'users',me.uid)).then(s => {
      if (s.exists()) setMyData(s.data());
    });
    // Set online
    updateDoc(doc(db,'users',me.uid), { status:'online', lastSeen: serverTimestamp() }).catch(()=>{});
    return () => {
      updateDoc(doc(db,'users',me.uid), { status:'offline', lastSeen: serverTimestamp() }).catch(()=>{});
    };
  }, []);

  // Load conversations (real-time)
  useEffect(() => {
    if (!me) return;
    const q = query(
      collection(db,'conversations'),
      where('members','array-contains', me.uid),
      orderBy('lastMessageAt','desc')
    );
    unsubConvs.current = onSnapshot(q, async (snap) => {
      const convList = [];
      for (const d of snap.docs) {
        const conv = { id: d.id, ...d.data() };
        const otherId = conv.members?.find(m => m !== me.uid);
        if (otherId) {
          try {
            const uSnap = await getDoc(doc(db,'users',otherId));
            conv.otherUser = uSnap.exists() ? { id: otherId, ...uSnap.data() } : { id: otherId };
          } catch(e) { conv.otherUser = { id: otherId }; }
        }
        convList.push(conv);
      }
      setConvs(convList);
    });
    return () => unsubConvs.current?.();
  }, []);

  // Load messages (real-time)
  useEffect(() => {
    if (!activeConv) return;
    if (unsubMsgs.current) unsubMsgs.current();
    setMessages([]);
    const q = query(
      collection(db,'conversations',activeConv.id,'messages'),
      orderBy('createdAt','asc')
    );
    unsubMsgs.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    // Reset unread
    updateDoc(doc(db,'conversations',activeConv.id), {
      [`unreadCount.${me.uid}`]: 0
    }).catch(()=>{});
    return () => unsubMsgs.current?.();
  }, [activeConv?.id]);

  /* ── SEND MESSAGE ── */
  async function sendMessage() {
    const t = text.trim();
    if (!t || !activeConv) return;
    setText('');
    setReplyTo(null);
    const otherId = activeConv.otherUser?.id;
    try {
      await addDoc(collection(db,'conversations',activeConv.id,'messages'), {
        senderId: me.uid,
        text: t,
        createdAt: serverTimestamp(),
        reply: replyTo?.text || null,
      });
      const upd = {
        lastMessage: t,
        lastMessageAt: serverTimestamp(),
      };
      if (otherId) upd[`unreadCount.${otherId}`] = (activeConv.unreadCount?.[otherId]||0)+1;
      await updateDoc(doc(db,'conversations',activeConv.id), upd);
    } catch(e) { Alert.alert('Erreur', e.message); }
  }

  /* ── SEARCH USERS ── */
  async function searchUsers(q) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db,'users'));
      const found = [];
      snap.forEach(d => {
        if (d.id === me.uid) return;
        const u = { id: d.id, ...d.data() };
        const name = ((u.prenom||'')+' '+(u.postnom||'')+' '+(u.nom||'')).toLowerCase();
        const ql = q.toLowerCase();
        if (name.includes(ql)||(u.email||'').toLowerCase().includes(ql)||(u.telephone||'').includes(ql)) {
          found.push(u);
        }
      });
      setSearchResults(found);
    } catch(e) { console.error(e); }
    finally { setSearching(false); }
  }

  /* ── START CONVERSATION ── */
  async function startConv(user) {
    setShowSearch(false);
    setSearchQ('');
    setSearchResults([]);
    // Check existing
    const existing = conversations.find(c => c.members?.includes(user.id) && c.members?.includes(me.uid));
    if (existing) { setActiveConv(existing); setShowSidebar(false); return; }
    setLoadingConv(true);
    try {
      const ref = await addDoc(collection(db,'conversations'), {
        members: [me.uid, user.id],
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        unreadCount: { [me.uid]:0, [user.id]:0 },
      });
      setActiveConv({ id: ref.id, members:[me.uid,user.id], otherUser:user, unreadCount:{} });
      setShowSidebar(false);
    } catch(e) { Alert.alert('Erreur', e.message); }
    finally { setLoadingConv(false); }
  }

  /* ── LOGOUT ── */
  async function logout() {
    Alert.alert('Déconnexion','Se déconnecter de ARKANET ?',[
      { text:'Annuler', style:'cancel' },
      { text:'Déconnecter', style:'destructive', onPress: async () => {
        try {
          await updateDoc(doc(db,'users',me.uid),{status:'offline',lastSeen:serverTimestamp()});
        } catch(e) {}
        await signOut(auth);
      }},
    ]);
  }

  /* ── RENDER MESSAGE ── */
  const renderMessage = useCallback(({ item, index }) => {
    const isOwn = item.senderId === me.uid;
    const prevMsg = index > 0 ? messages[index-1] : null;
    const showDate = !prevMsg || formatDate(item.createdAt) !== formatDate(prevMsg.createdAt);
    const showSender = !isOwn && (!prevMsg || prevMsg.senderId !== item.senderId);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSep}>
            <View style={styles.dateLine}/><Text style={styles.dateTxt}>{formatDate(item.createdAt)}</Text><View style={styles.dateLine}/>
          </View>
        )}
        <TouchableOpacity
          style={[styles.msgRow, isOwn && styles.msgRowOwn]}
          onLongPress={() => Alert.alert('Message',item.text,[
            {text:'Répondre', onPress:()=>setReplyTo(item)},
            {text:'Copier', onPress:()=>{}},
            {text:'Annuler',style:'cancel'},
          ])}
          activeOpacity={0.9}
        >
          {!isOwn && (
            <View style={styles.msgAv}>
              <Text style={styles.msgAvTxt}>{getInitials(activeConv?.otherUser)}</Text>
            </View>
          )}
          <View style={[styles.msgBubble, isOwn && styles.msgBubbleOwn, {maxWidth: width*0.72}]}>
            {!isOwn && showSender && (
              <Text style={styles.msgSender}>{getFullName(activeConv?.otherUser)}</Text>
            )}
            {item.reply && (
              <View style={styles.replyBox}>
                <Text style={styles.replyTxt}>↩ {item.reply}</Text>
              </View>
            )}
            <Text style={styles.msgTxt}>{item.text}</Text>
            <View style={styles.msgMeta}>
              <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
              {isOwn && <Text style={[styles.tick, styles.tickSeen]}>✓✓</Text>}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [messages, activeConv, me.uid]);

  /* ── SIDEBAR ── */
  const renderConv = ({ item }) => {
    const other = item.otherUser || {};
    const unread = item.unreadCount?.[me.uid] || 0;
    const isActive = activeConv?.id === item.id;
    const isOnline = other.status === 'online';
    return (
      <TouchableOpacity
        style={[styles.convItem, isActive && styles.convItemActive]}
        onPress={() => { setActiveConv(item); setShowSidebar(false); }}
        activeOpacity={0.8}
      >
        <View style={styles.convAv}>
          <Text style={styles.convAvTxt}>{getInitials(other)}</Text>
          {isOnline && <View style={styles.onlineDot}/>}
        </View>
        <View style={styles.convInfo}>
          <Text style={styles.convName} numberOfLines={1}>{getFullName(other)}</Text>
          <Text style={styles.convLast} numberOfLines={1}>{item.lastMessage||'Démarrer la conversation'}</Text>
        </View>
        <View style={styles.convMeta}>
          <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread}</Text></View>}
        </View>
      </TouchableOpacity>
    );
  };

  /* ══════ RENDER ══════ */
  return (
    <View style={styles.container}>

      {/* ─── SIDEBAR ─── */}
      {showSidebar && (
        <View style={styles.sidebar}>
          {/* Header */}
          <View style={styles.sidebarHeader}>
            <View style={styles.sidebarLogo}>
              <View style={styles.statusDot}/>
              <Text style={styles.sidebarLogoTxt}>ARKANET</Text>
            </View>
            <TouchableOpacity style={styles.myProfile} onPress={()=>setShowSettings(true)}>
              <View style={[styles.convAv,{width:36,height:36}]}>
                <Text style={[styles.convAvTxt,{fontSize:12}]}>{getInitials(myData)}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.myName} numberOfLines={1}>{getFullName(myData)}</Text>
                <Text style={styles.myStatus}>● EN LIGNE</Text>
              </View>
              <Text style={{color:GREEN_DIM,fontSize:16}}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <TouchableOpacity style={styles.searchBar} onPress={()=>setShowSearch(true)}>
            <Text style={styles.searchPlaceholder}>🔍  RECHERCHER UN UTILISATEUR</Text>
          </TouchableOpacity>

          {/* Conversations */}
          {conversations.length === 0 ? (
            <View style={styles.emptyConvs}>
              <Text style={styles.emptyConvsTxt}>Aucune conversation.{'\n'}Appuyez sur + pour commencer.</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={i=>i.id}
              renderItem={renderConv}
              style={{flex:1}}
            />
          )}

          {/* Footer */}
          <View style={styles.sidebarFooter}>
            <TouchableOpacity style={styles.footerBtn} onPress={()=>setShowSearch(true)}>
              <Text style={styles.footerBtnTxt}>＋ NOUVEAU</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} onPress={()=>setShowSettings(true)}>
              <Text style={styles.footerBtnTxt}>PARAM.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn,styles.footerBtnDanger]} onPress={logout}>
              <Text style={[styles.footerBtnTxt,{color:RED}]}>DÉCO.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── CHAT ─── */}
      {!showSidebar && (
        <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS==='ios'?'padding':'height'}>
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={()=>setShowSidebar(true)} style={styles.backChatBtn}>
              <Text style={{color:GREEN,fontSize:20}}>←</Text>
            </TouchableOpacity>
            <View style={[styles.convAv,{width:36,height:36}]}>
              <Text style={[styles.convAvTxt,{fontSize:12}]}>{getInitials(activeConv?.otherUser)}</Text>
              {activeConv?.otherUser?.status==='online' && <View style={styles.onlineDot}/>}
            </View>
            <View style={{flex:1}}>
              <Text style={styles.chatName}>{getFullName(activeConv?.otherUser)}</Text>
              <Text style={styles.chatStatus}>
                {activeConv?.otherUser?.status==='online'?'● EN LIGNE · CHIFFRÉ E2E':'○ HORS LIGNE'}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={i=>i.id}
            renderItem={renderMessage}
            style={styles.msgList}
            contentContainerStyle={{padding:14, paddingBottom:8}}
            onContentSizeChange={()=>flatRef.current?.scrollToEnd({animated:true})}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={{fontSize:40}}>💬</Text>
                <Text style={styles.emptyChatTxt}>Démarrez la conversation !</Text>
              </View>
            }
          />

          {/* Reply preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyPreviewTxt} numberOfLines={1}>↩ {replyTo.text}</Text>
              <TouchableOpacity onPress={()=>setReplyTo(null)}>
                <Text style={{color:RED,fontSize:18}}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="[ MESSAGE CHIFFRÉ... ]"
              placeholderTextColor="rgba(0,255,65,0.2)"
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim()&&{opacity:0.4}]}
              onPress={sendMessage}
              disabled={!text.trim()}
            >
              <Text style={styles.sendBtnTxt}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ─── SEARCH MODAL ─── */}
      <Modal visible={showSearch} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={()=>{setShowSearch(false);setSearchQ('');setSearchResults([]);}}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.searchModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>NOUVELLE CONVERSATION</Text>
                  <TouchableOpacity onPress={()=>{setShowSearch(false);setSearchQ('');setSearchResults([]);}}>
                    <Text style={{color:RED,fontSize:22}}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput,{margin:14,borderColor:'rgba(0,255,65,0.3)'}]}
                  value={searchQ}
                  onChangeText={v=>{setSearchQ(v);searchUsers(v);}}
                  placeholder="Nom, email ou numéro..."
                  placeholderTextColor="rgba(0,255,65,0.25)"
                  autoFocus
                />
                {searching && <ActivityIndicator color={GREEN} style={{marginTop:20}}/>}
                {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                  <Text style={styles.noResult}>Aucun utilisateur trouvé pour "{searchQ}"</Text>
                )}
                <FlatList
                  data={searchResults}
                  keyExtractor={i=>i.id}
                  renderItem={({item})=>(
                    <TouchableOpacity style={styles.resultItem} onPress={()=>startConv(item)}>
                      <View style={[styles.convAv,{width:42,height:42}]}>
                        <Text style={styles.convAvTxt}>{getInitials(item)}</Text>
                        {item.status==='online'&&<View style={styles.onlineDot}/>}
                      </View>
                      <View style={{flex:1}}>
                        <Text style={styles.resultName}>{getFullName(item)}</Text>
                        <Text style={styles.resultDetail}>{item.email||item.telephone||''}</Text>
                      </View>
                      <Text style={{fontSize:22,color:GREEN}}>💬</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── SETTINGS MODAL ─── */}
      <Modal visible={showSettings} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={()=>setShowSettings(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.searchModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>PARAMÈTRES</Text>
                  <TouchableOpacity onPress={()=>setShowSettings(false)}>
                    <Text style={{color:RED,fontSize:22}}>✕</Text>
                  </TouchableOpacity>
                </View>
                {/* Profile info */}
                <View style={{padding:16,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.08)'}}>
                  <View style={[styles.convAv,{width:60,height:60,alignSelf:'center',marginBottom:10}]}>
                    <Text style={[styles.convAvTxt,{fontSize:20}]}>{getInitials(myData)}</Text>
                  </View>
                  <Text style={[styles.resultName,{textAlign:'center'}]}>{getFullName(myData)}</Text>
                  <Text style={[styles.resultDetail,{textAlign:'center'}]}>{myData?.email||''}</Text>
                </View>
                {/* Settings rows */}
                {[
                  {label:'EMAIL', val: myData?.email||'—'},
                  {label:'TÉLÉPHONE', val: myData?.telephone||'—'},
                  {label:'DATE DE NAISSANCE', val: myData?.dateNaissance||'—'},
                  {label:'MEMBRE DEPUIS', val: myData?.createdAt?.toDate?.().toLocaleDateString('fr-FR')||'—'},
                  {label:'CHIFFREMENT', val: 'AES-256 E2E ✓'},
                ].map((r,i)=>(
                  <View key={i} style={{flexDirection:'row',justifyContent:'space-between',
                    padding:14,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.06)'}}>
                    <Text style={{color:GREEN_DIM,fontFamily:'monospace',fontSize:11,letterSpacing:2}}>{r.label}</Text>
                    <Text style={{color:GREEN,fontFamily:'monospace',fontSize:11}}>{r.val}</Text>
                  </View>
                ))}
                <TouchableOpacity style={[styles.footerBtn,{margin:16,backgroundColor:'rgba(255,58,58,0.1)',borderColor:RED}]} onPress={logout}>
                  <Text style={[styles.footerBtnTxt,{color:RED,letterSpacing:3}]}>🔒 SE DÉCONNECTER</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000',flexDirection:'row'},

  /* SIDEBAR */
  sidebar:{width:'100%',backgroundColor:'rgba(0,6,1,0.97)',borderRightWidth:1,borderRightColor:'rgba(0,255,65,0.12)'},
  sidebarHeader:{padding:14,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.12)'},
  sidebarLogo:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},
  statusDot:{width:8,height:8,borderRadius:4,backgroundColor:GREEN,shadowColor:GREEN,shadowRadius:6,shadowOpacity:1},
  sidebarLogoTxt:{color:GREEN,fontFamily:'monospace',fontWeight:'900',fontSize:18,letterSpacing:4,
    textShadowColor:'rgba(0,255,65,0.5)',textShadowOffset:{width:0,height:0},textShadowRadius:10},
  myProfile:{flexDirection:'row',alignItems:'center',gap:10,padding:10,
    borderWidth:1,borderColor:'rgba(0,255,65,0.15)',backgroundColor:'rgba(0,255,65,0.03)'},
  myName:{color:'#c8ffd4',fontFamily:'monospace',fontSize:11,letterSpacing:2},
  myStatus:{color:GREEN,fontFamily:'monospace',fontSize:9,letterSpacing:1,opacity:0.8,marginTop:1},

  searchBar:{margin:10,padding:12,borderWidth:1,borderColor:'rgba(0,255,65,0.15)',
    backgroundColor:'rgba(0,255,65,0.04)'},
  searchPlaceholder:{color:'rgba(0,255,65,0.35)',fontFamily:'monospace',fontSize:12,letterSpacing:2},

  convItem:{flexDirection:'row',alignItems:'center',gap:10,padding:12,
    borderLeftWidth:2,borderLeftColor:'transparent'},
  convItemActive:{backgroundColor:'rgba(0,255,65,0.09)',borderLeftColor:GREEN},
  convAv:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(0,255,65,0.07)',
    borderWidth:1,borderColor:'rgba(0,255,65,0.22)',justifyContent:'center',alignItems:'center',position:'relative'},
  convAvTxt:{color:GREEN,fontFamily:'monospace',fontWeight:'700',fontSize:14},
  onlineDot:{position:'absolute',bottom:1,right:1,width:10,height:10,borderRadius:5,
    backgroundColor:GREEN,borderWidth:2,borderColor:'rgba(0,6,1,0.97)'},
  convInfo:{flex:1,minWidth:0},
  convName:{color:'#c8ffd4',fontFamily:'monospace',fontSize:11,letterSpacing:1},
  convLast:{color:'#5a8c62',fontFamily:'monospace',fontSize:10,letterSpacing:1,marginTop:2},
  convMeta:{alignItems:'flex-end',gap:4},
  convTime:{color:'#5a8c62',fontFamily:'monospace',fontSize:9,letterSpacing:1},
  badge:{backgroundColor:GREEN,minWidth:18,height:18,borderRadius:9,justifyContent:'center',alignItems:'center',paddingHorizontal:4},
  badgeTxt:{color:'#000',fontFamily:'monospace',fontSize:9,fontWeight:'700'},
  emptyConvs:{flex:1,justifyContent:'center',alignItems:'center',padding:30},
  emptyConvsTxt:{color:'#5a8c62',fontFamily:'monospace',fontSize:11,letterSpacing:2,textAlign:'center',lineHeight:20},

  sidebarFooter:{flexDirection:'row',gap:6,padding:10,borderTopWidth:1,borderTopColor:'rgba(0,255,65,0.12)'},
  footerBtn:{flex:1,padding:10,borderWidth:1,borderColor:'rgba(0,255,65,0.15)',alignItems:'center'},
  footerBtnDanger:{borderColor:'rgba(255,58,58,0.15)'},
  footerBtnTxt:{color:'#5a8c62',fontFamily:'monospace',fontSize:10,letterSpacing:2},

  /* CHAT */
  chatArea:{flex:1,backgroundColor:'rgba(0,3,1,0.97)'},
  chatHeader:{height:58,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,
    borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.12)',backgroundColor:'rgba(0,5,1,0.98)'},
  backChatBtn:{padding:4,marginRight:4},
  chatName:{color:GREEN,fontFamily:'monospace',fontWeight:'700',fontSize:13,letterSpacing:2},
  chatStatus:{color:GREEN_DIM,fontFamily:'monospace',fontSize:10,letterSpacing:2,marginTop:1},

  msgList:{flex:1},
  msgRow:{flexDirection:'row',alignItems:'flex-end',gap:6,marginVertical:3},
  msgRowOwn:{flexDirection:'row-reverse'},
  msgAv:{width:28,height:28,borderRadius:14,backgroundColor:'rgba(0,255,65,0.07)',
    borderWidth:1,borderColor:'rgba(0,255,65,0.2)',justifyContent:'center',alignItems:'center',marginBottom:2},
  msgAvTxt:{color:GREEN,fontFamily:'monospace',fontSize:10,fontWeight:'700'},
  msgBubble:{backgroundColor:'rgba(0,255,65,0.08)',borderWidth:1,borderColor:'rgba(0,255,65,0.13)',
    padding:10,borderRadius:2},
  msgBubbleOwn:{backgroundColor:'rgba(0,255,65,0.16)',borderColor:'rgba(0,255,65,0.28)'},
  msgSender:{color:GREEN_DIM,fontFamily:'monospace',fontSize:9,letterSpacing:2,marginBottom:3},
  msgTxt:{color:'#c8ffd4',fontFamily:'monospace',fontSize:13,lineHeight:20},
  msgMeta:{flexDirection:'row',alignItems:'center',gap:4,marginTop:4,justifyContent:'flex-end'},
  msgTime:{color:'#5a8c62',fontFamily:'monospace',fontSize:9,letterSpacing:1},
  tick:{fontSize:10,color:GREEN},tickSeen:{color:BLUE},
  replyBox:{borderLeftWidth:2,borderLeftColor:GREEN_DIM,paddingLeft:8,marginBottom:6,opacity:0.7},
  replyTxt:{color:GREEN_DIM,fontFamily:'monospace',fontSize:10},

  dateSep:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:10},
  dateLine:{flex:1,height:1,backgroundColor:'rgba(0,255,65,0.08)'},
  dateTxt:{color:'#5a8c62',fontFamily:'monospace',fontSize:9,letterSpacing:3},

  emptyChat:{flex:1,alignItems:'center',justifyContent:'center',gap:12,opacity:0.4,marginTop:100},
  emptyChatTxt:{color:GREEN_DIM,fontFamily:'monospace',fontSize:12,letterSpacing:3},

  replyPreview:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    padding:10,paddingHorizontal:14,backgroundColor:'rgba(0,255,65,0.05)',
    borderLeftWidth:2,borderLeftColor:GREEN},
  replyPreviewTxt:{color:'#5a8c62',fontFamily:'monospace',fontSize:11,flex:1},

  inputArea:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,
    borderTopWidth:1,borderTopColor:'rgba(0,255,65,0.12)',backgroundColor:'rgba(0,4,1,0.98)'},
  textInput:{flex:1,backgroundColor:'rgba(0,255,65,0.04)',borderWidth:1,
    borderColor:'rgba(0,255,65,0.18)',padding:10,color:GREEN,fontFamily:'monospace',
    fontSize:13,maxHeight:100,minHeight:40},
  sendBtn:{width:42,height:42,backgroundColor:GREEN,justifyContent:'center',alignItems:'center'},
  sendBtnTxt:{color:'#000',fontSize:18,fontWeight:'700'},

  /* MODALS */
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'flex-end'},
  searchModal:{backgroundColor:'rgba(0,6,1,0.99)',borderTopWidth:1,borderTopColor:GREEN,
    maxHeight:'85%',borderWidth:1,borderColor:'rgba(0,255,65,0.2)'},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
    padding:16,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.15)'},
  modalTitle:{color:GREEN,fontFamily:'monospace',fontSize:14,fontWeight:'900',letterSpacing:4},
  noResult:{color:'#5a8c62',fontFamily:'monospace',fontSize:11,letterSpacing:2,
    textAlign:'center',padding:24},
  resultItem:{flexDirection:'row',alignItems:'center',gap:12,padding:14,
    borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.07)'},
  resultName:{color:'#c8ffd4',fontFamily:'monospace',fontSize:12,letterSpacing:2},
  resultDetail:{color:'#5a8c62',fontFamily:'monospace',fontSize:10,letterSpacing:1,marginTop:2},
});

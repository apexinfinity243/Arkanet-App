import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Animated, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

const GREEN = '#00ff41';
const GREEN_DIM = '#00b32c';
const RED = '#ff3a3a';

export default function LoginScreen({ navigation }) {
  const [tab, setTab]           = useState('email'); // 'email' | 'phone'
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const cardAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(cardAnim, { toValue:1, duration:700, useNativeDriver:true }).start();
  }, []);

  async function handleLogin() {
    setError('');
    const identifier = tab === 'email' ? email.trim() : phone.trim();
    if (!identifier) { setError('Entrez votre ' + (tab==='email'?'email':'numéro')); return; }
    if (!password)   { setError('Mot de passe requis'); return; }

    setLoading(true);
    try {
      const emailToUse = tab === 'phone'
        ? identifier.replace(/\s/g,'') + '@arkanet.app'
        : identifier;
      await signInWithEmailAndPassword(auth, emailToUse, password);
      // Navigation handled by onAuthStateChanged in App.js
    } catch(e) {
      const msgs = {
        'auth/user-not-found':    'UTILISATEUR INTROUVABLE',
        'auth/wrong-password':    'MOT DE PASSE INCORRECT',
        'auth/invalid-email':     'FORMAT EMAIL INVALIDE',
        'auth/too-many-requests': 'TROP DE TENTATIVES',
        'auth/invalid-credential':'IDENTIFIANTS INCORRECTS',
      };
      setError(msgs[e.code] || 'ERREUR: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backTxt}>← RETOUR</Text>
        </TouchableOpacity>

        {/* Logo mini */}
        <View style={styles.logoMini}>
          <Text style={styles.logoText}>ARKANET</Text>
          <Text style={styles.logoSub}>AUTHENTIFICATION REQUISE</Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, {
          opacity: cardAnim,
          transform:[{ translateY: cardAnim.interpolate({inputRange:[0,1],outputRange:[30,0]}) }]
        }]}>
          {/* Corners */}
          <View style={[styles.corner, styles.cTL]}/><View style={[styles.corner, styles.cTR]}/>
          <View style={[styles.corner, styles.cBL]}/><View style={[styles.corner, styles.cBR]}/>

          <Text style={styles.cardTitle}>&gt; CONNEXION AU RÉSEAU</Text>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab==='phone'&&styles.tabActive]} onPress={()=>setTab('phone')}>
              <Text style={[styles.tabTxt, tab==='phone'&&styles.tabTxtActive]}>📱 NUMÉRO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab==='email'&&styles.tabActive]} onPress={()=>setTab('email')}>
              <Text style={[styles.tabTxt, tab==='email'&&styles.tabTxtActive]}>✉️ EMAIL</Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          {tab === 'email' ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>ADRESSE EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="vous@gmail.com"
                placeholderTextColor="rgba(0,255,65,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : (
            <View style={styles.formGroup}>
              <Text style={styles.label}>NUMÉRO DE TÉLÉPHONE</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+243 000 000 000"
                placeholderTextColor="rgba(0,255,65,0.25)"
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* Password */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>MOT DE PASSE</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, {flex:1}]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor="rgba(0,255,65,0.25)"
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={()=>setShowPass(!showPass)}>
                <Text style={{fontSize:18}}>{showPass?'🙈':'👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

          {/* Submit */}
          <TouchableOpacity style={styles.btn} onPress={handleLogin} activeOpacity={0.8} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnTxt}>ACCÉDER AU RÉSEAU</Text>
            }
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkTxt}>PAS ENCORE MEMBRE ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.linkTxt, {color:GREEN}]}>S'INSCRIRE</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#000' },
  scroll: { flexGrow:1, alignItems:'center', justifyContent:'center', padding:20, paddingTop:60 },
  backBtn: { position:'absolute', top:20, left:20, borderWidth:1, borderColor:'rgba(0,255,65,0.2)', padding:8, paddingHorizontal:14 },
  backTxt: { color:GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:3 },
  logoMini: { alignItems:'center', marginBottom:32 },
  logoText: { color:GREEN, fontFamily:'monospace', fontSize:32, fontWeight:'900', letterSpacing:10,
    textShadowColor:'rgba(0,255,65,0.5)', textShadowOffset:{width:0,height:0}, textShadowRadius:15 },
  logoSub: { color:GREEN_DIM, fontFamily:'monospace', fontSize:10, letterSpacing:5, opacity:0.7, marginTop:5 },

  card: { width:'100%', maxWidth:420, backgroundColor:'rgba(0,8,2,0.95)',
    borderWidth:1, borderColor:'rgba(0,255,65,0.2)', padding:32, position:'relative' },
  corner: { position:'absolute', width:10, height:10, borderColor:GREEN, opacity:0.45 },
  cTL: { top:8, left:8, borderTopWidth:1, borderLeftWidth:1 },
  cTR: { top:8, right:8, borderTopWidth:1, borderRightWidth:1 },
  cBL: { bottom:8, left:8, borderBottomWidth:1, borderLeftWidth:1 },
  cBR: { bottom:8, right:8, borderBottomWidth:1, borderRightWidth:1 },

  cardTitle: { color:GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:4, marginBottom:22 },

  tabs: { flexDirection:'row', borderWidth:1, borderColor:'rgba(0,255,65,0.2)', marginBottom:24 },
  tab: { flex:1, padding:10, alignItems:'center', backgroundColor:'transparent' },
  tabActive: { backgroundColor:'rgba(0,255,65,0.12)' },
  tabTxt: { color:GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:2 },
  tabTxtActive: { color:GREEN },

  formGroup: { marginBottom:18 },
  label: { color:GREEN_DIM, fontFamily:'monospace', fontSize:10, letterSpacing:3, marginBottom:8 },
  input: { backgroundColor:'rgba(0,255,65,0.04)', borderWidth:1, borderColor:'rgba(0,255,65,0.2)',
    padding:13, color:GREEN, fontFamily:'monospace', fontSize:14, letterSpacing:1 },
  passRow: { flexDirection:'row', alignItems:'center' },
  eyeBtn: { position:'absolute', right:10, padding:4 },

  errorTxt: { color:RED, fontFamily:'monospace', fontSize:10, letterSpacing:2, marginBottom:12 },

  btn: { backgroundColor:GREEN, padding:16, alignItems:'center', marginTop:8 },
  btnTxt: { color:'#000', fontFamily:'monospace', fontSize:14, fontWeight:'700', letterSpacing:4 },

  linkRow: { flexDirection:'row', justifyContent:'center', marginTop:20 },
  linkTxt: { color:'rgba(0,255,65,0.4)', fontFamily:'monospace', fontSize:10, letterSpacing:2 },
});

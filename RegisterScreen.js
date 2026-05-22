import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const GREEN = '#00ff41';
const GREEN_DIM = '#00b32c';
const RED = '#ff3a3a';

const COUNTRIES = [
  {code:'+243',flag:'🇨🇩',name:'RD Congo'},{code:'+242',flag:'🇨🇬',name:'Congo Brazzaville'},
  {code:'+237',flag:'🇨🇲',name:'Cameroun'},{code:'+225',flag:'🇨🇮',name:"Côte d'Ivoire"},
  {code:'+221',flag:'🇸🇳',name:'Sénégal'},{code:'+234',flag:'🇳🇬',name:'Nigeria'},
  {code:'+254',flag:'🇰🇪',name:'Kenya'},{code:'+255',flag:'🇹🇿',name:'Tanzanie'},
  {code:'+256',flag:'🇺🇬',name:'Ouganda'},{code:'+250',flag:'🇷🇼',name:'Rwanda'},
  {code:'+257',flag:'🇧🇮',name:'Burundi'},{code:'+233',flag:'🇬🇭',name:'Ghana'},
  {code:'+212',flag:'🇲🇦',name:'Maroc'},{code:'+213',flag:'🇩🇿',name:'Algérie'},
  {code:'+216',flag:'🇹🇳',name:'Tunisie'},{code:'+20',flag:'🇪🇬',name:'Égypte'},
  {code:'+27',flag:'🇿🇦',name:'Afrique du Sud'},{code:'+33',flag:'🇫🇷',name:'France'},
  {code:'+32',flag:'🇧🇪',name:'Belgique'},{code:'+41',flag:'🇨🇭',name:'Suisse'},
  {code:'+1',flag:'🇺🇸',name:'États-Unis / Canada'},{code:'+44',flag:'🇬🇧',name:'Royaume-Uni'},
  {code:'+49',flag:'🇩🇪',name:'Allemagne'},{code:'+34',flag:'🇪🇸',name:'Espagne'},
  {code:'+39',flag:'🇮🇹',name:'Italie'},{code:'+351',flag:'🇵🇹',name:'Portugal'},
  {code:'+7',flag:'🇷🇺',name:'Russie'},{code:'+86',flag:'🇨🇳',name:'Chine'},
  {code:'+91',flag:'🇮🇳',name:'Inde'},{code:'+55',flag:'🇧🇷',name:'Brésil'},
  {code:'+52',flag:'🇲🇽',name:'Mexique'},{code:'+54',flag:'🇦🇷',name:'Argentine'},
  {code:'+57',flag:'🇨🇴',name:'Colombie'},{code:'+81',flag:'🇯🇵',name:'Japon'},
  {code:'+82',flag:'🇰🇷',name:'Corée du Sud'},{code:'+966',flag:'🇸🇦',name:'Arabie saoudite'},
  {code:'+971',flag:'🇦🇪',name:'Émirats arabes'},{code:'+90',flag:'🇹🇷',name:'Turquie'},
];

export default function RegisterScreen({ navigation }) {
  const [step, setStep]           = useState(1);
  const [nom, setNom]             = useState('');
  const [postnom, setPostnom]     = useState('');
  const [prenom, setPrenom]       = useState('');
  const [dobJ, setDobJ]           = useState('');
  const [dobM, setDobM]           = useState('');
  const [dobA, setDobA]           = useState('');
  const [country, setCountry]     = useState(COUNTRIES[0]);
  const [phone, setPhone]         = useState('');
  const [gmail, setGmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showCountry, setShowCountry] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showOTP, setShowOTP]     = useState(false);
  const [otp, setOtp]             = useState(['','','','','','']);
  const [generatedOtp, setGeneratedOtp] = useState('');

  const dobMRef = useRef(); const dobARef = useRef();

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  function validateStep1() {
    if(!nom||!postnom||!prenom){ setError('Tous les champs sont requis'); return false; }
    const j=parseInt(dobJ),m=parseInt(dobM),a=parseInt(dobA);
    if(!dobJ||!dobM||!dobA||j<1||j>31||m<1||m>12||a<1900||a>2025||dobA.length<4){
      setError('Date de naissance invalide'); return false;
    }
    setError(''); return true;
  }

  function validateStep2() {
    if(!phone){ setError('Numéro de téléphone requis'); return false; }
    if(!gmail||!gmail.includes('@')||!gmail.includes('.')){ setError('Email invalide'); return false; }
    setError(''); return true;
  }

  function validateStep3() {
    if(password.length < 8){ setError('Mot de passe trop court (min. 8 caractères)'); return false; }
    if(password !== password2){ setError('Les mots de passe ne correspondent pas'); return false; }
    setError(''); return true;
  }

  function nextStep() {
    if(step===1 && !validateStep1()) return;
    if(step===2 && !validateStep2()) return;
    if(step===3){ handleRegister(); return; }
    setStep(s => s+1);
  }

  function handleOtpChange(val, idx) {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
  }

  async function handleRegister() {
    if(!validateStep3()) return;
    setLoading(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, gmail, password);
      const dob = `${dobJ.padStart(2,'0')}/${dobM.padStart(2,'0')}/${dobA}`;
      await setDoc(doc(db,'users',cred.user.uid), {
        nom, postnom, prenom,
        dateNaissance: dob,
        telephone: country.code + phone,
        email: gmail,
        status: 'online',
        createdAt: serverTimestamp(),
      });
      // Generate OTP
      const code = String(Math.floor(100000 + Math.random()*900000));
      setGeneratedOtp(code);
      setShowOTP(true);
    } catch(e) {
      const msgs = {
        'auth/email-already-in-use': 'EMAIL DÉJÀ UTILISÉ',
        'auth/weak-password':        'MOT DE PASSE TROP FAIBLE',
        'auth/invalid-email':        'FORMAT EMAIL INVALIDE',
      };
      setError(msgs[e.code] || 'ERREUR: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function verifyOtp() {
    const entered = otp.join('');
    if(entered === generatedOtp) {
      setShowOTP(false);
      // Navigation handled by onAuthStateChanged
    } else {
      Alert.alert('CODE INCORRECT', 'Vérifiez le code et réessayez.');
      setOtp(['','','','','','']);
    }
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.backBtn} onPress={() => step>1 ? setStep(s=>s-1) : navigation.goBack()}>
          <Text style={styles.backTxt}>← RETOUR</Text>
        </TouchableOpacity>

        <View style={styles.logoMini}>
          <Text style={styles.logoText}>ARKANET</Text>
          <Text style={styles.logoSub}>CRÉATION DE COMPTE</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressWrap}>
          <View style={styles.stepsRow}>
            {['IDENTITÉ','CONTACT','SÉCURITÉ'].map((s,i)=>(
              <View key={i} style={[styles.stepBadge, step===i+1&&styles.stepActive, step>i+1&&styles.stepDone]}>
                <Text style={[styles.stepTxt, (step===i+1||step>i+1)&&{color:step>i+1?'#000':GREEN}]}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width:`${progressPct}%`}]} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.corner, styles.cTL]}/><View style={[styles.corner, styles.cTR]}/>
          <View style={[styles.corner, styles.cBL]}/><View style={[styles.corner, styles.cBR]}/>

          {/* STEP 1 - IDENTITÉ */}
          {step === 1 && (
            <View>
              <Text style={styles.cardTitle}>&gt; ÉTAPE 1 · IDENTITÉ</Text>
              <View style={styles.row}>
                <View style={[styles.formGroup,{flex:1,marginRight:8}]}>
                  <Text style={styles.label}>NOM *</Text>
                  <TextInput style={styles.input} value={nom} onChangeText={setNom}
                    placeholder="DUPONT" placeholderTextColor="rgba(0,255,65,0.22)" autoCapitalize="characters"/>
                </View>
                <View style={[styles.formGroup,{flex:1}]}>
                  <Text style={styles.label}>POST-NOM *</Text>
                  <TextInput style={styles.input} value={postnom} onChangeText={setPostnom}
                    placeholder="JEAN" placeholderTextColor="rgba(0,255,65,0.22)" autoCapitalize="characters"/>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>PRÉNOM *</Text>
                <TextInput style={styles.input} value={prenom} onChangeText={setPrenom}
                  placeholder="MARIE" placeholderTextColor="rgba(0,255,65,0.22)" autoCapitalize="characters"/>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>DATE DE NAISSANCE (JJ/MM/AAAA) *</Text>
                <View style={styles.dateRow}>
                  <TextInput style={[styles.input,{flex:1,textAlign:'center'}]} value={dobJ}
                    onChangeText={v=>{setDobJ(v);if(v.length===2)dobMRef.current?.focus();}}
                    placeholder="JJ" placeholderTextColor="rgba(0,255,65,0.22)" keyboardType="numeric" maxLength={2}/>
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput ref={dobMRef} style={[styles.input,{flex:1,textAlign:'center'}]} value={dobM}
                    onChangeText={v=>{setDobM(v);if(v.length===2)dobARef.current?.focus();}}
                    placeholder="MM" placeholderTextColor="rgba(0,255,65,0.22)" keyboardType="numeric" maxLength={2}/>
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput ref={dobARef} style={[styles.input,{flex:2,textAlign:'center'}]} value={dobA}
                    onChangeText={setDobA}
                    placeholder="AAAA" placeholderTextColor="rgba(0,255,65,0.22)" keyboardType="numeric" maxLength={4}/>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2 - CONTACT */}
          {step === 2 && (
            <View>
              <Text style={styles.cardTitle}>&gt; ÉTAPE 2 · CONTACT</Text>
              <View style={styles.formGroup}>
                <Text style={styles.label}>NUMÉRO DE TÉLÉPHONE *</Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity style={styles.countryBtn} onPress={()=>setShowCountry(true)}>
                    <Text style={styles.countryTxt}>{country.flag} {country.code}</Text>
                  </TouchableOpacity>
                  <TextInput style={[styles.input,{flex:1}]} value={phone} onChangeText={setPhone}
                    placeholder="000 000 000" placeholderTextColor="rgba(0,255,65,0.22)" keyboardType="phone-pad"/>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>ADRESSE EMAIL *</Text>
                <TextInput style={styles.input} value={gmail} onChangeText={setGmail}
                  placeholder="vous@gmail.com" placeholderTextColor="rgba(0,255,65,0.22)"
                  keyboardType="email-address" autoCapitalize="none"/>
              </View>
            </View>
          )}

          {/* STEP 3 - SÉCURITÉ */}
          {step === 3 && (
            <View>
              <Text style={styles.cardTitle}>&gt; ÉTAPE 3 · SÉCURITÉ</Text>
              <View style={styles.formGroup}>
                <Text style={styles.label}>MOT DE PASSE *</Text>
                <View style={styles.passRow}>
                  <TextInput style={[styles.input,{flex:1}]} value={password} onChangeText={setPassword}
                    placeholder="••••••••••••" placeholderTextColor="rgba(0,255,65,0.22)"
                    secureTextEntry={!showPass} autoCapitalize="none"/>
                  <TouchableOpacity style={styles.eyeBtn} onPress={()=>setShowPass(!showPass)}>
                    <Text style={{fontSize:18}}>{showPass?'🙈':'👁'}</Text>
                  </TouchableOpacity>
                </View>
                {/* Strength */}
                <View style={styles.strengthBar}>
                  <View style={[styles.strengthFill, {
                    width: password.length===0?'0%':password.length<6?'25%':password.length<10?'60%':'100%',
                    backgroundColor: password.length<6?RED:password.length<10?'#ffd700':GREEN
                  }]}/>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>CONFIRMER LE MOT DE PASSE *</Text>
                <View style={styles.passRow}>
                  <TextInput style={[styles.input,{flex:1}]} value={password2} onChangeText={setPassword2}
                    placeholder="••••••••••••" placeholderTextColor="rgba(0,255,65,0.22)"
                    secureTextEntry={!showPass2} autoCapitalize="none"/>
                  <TouchableOpacity style={styles.eyeBtn} onPress={()=>setShowPass2(!showPass2)}>
                    <Text style={{fontSize:18}}>{showPass2?'🙈':'👁'}</Text>
                  </TouchableOpacity>
                </View>
                {password2.length>0 && (
                  <Text style={{color: password===password2?GREEN:RED, fontFamily:'monospace', fontSize:10, marginTop:4, letterSpacing:2}}>
                    {password===password2?'✓ MOTS DE PASSE IDENTIQUES':'✗ NE CORRESPONDENT PAS'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={nextStep} activeOpacity={0.8} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnTxt}>{step===3?"S'INSCRIRE":"SUIVANT →"}</Text>
            }
          </TouchableOpacity>

          {step===1 && (
            <View style={styles.linkRow}>
              <Text style={styles.linkTxt}>DÉJÀ MEMBRE ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.linkTxt, {color:GREEN}]}>SE CONNECTER</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* COUNTRY PICKER MODAL */}
      <Modal visible={showCountry} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CHOISIR UN PAYS</Text>
              <TouchableOpacity onPress={()=>setShowCountry(false)}>
                <Text style={{color:RED,fontSize:22}}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input,{margin:14}]}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Rechercher..."
              placeholderTextColor="rgba(0,255,65,0.25)"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={i=>i.code+i.name}
              renderItem={({item})=>(
                <TouchableOpacity style={styles.countryItem} onPress={()=>{setCountry(item);setShowCountry(false);setCountrySearch('');}}>
                  <Text style={styles.countryItemTxt}>{item.flag}  {item.code}  {item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* OTP MODAL */}
      <Modal visible={showOTP} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox,{alignItems:'center',padding:32}]}>
            <Text style={[styles.modalTitle,{marginBottom:12}]}>VÉRIFICATION</Text>
            <Text style={styles.otpSub}>Code envoyé à {gmail}{'\n'}
              <Text style={{opacity:0.5,fontSize:10}}>(DEMO — code: {generatedOtp})</Text>
            </Text>
            <View style={styles.otpRow}>
              {otp.map((v,i)=>(
                <TextInput key={i} style={styles.otpInput} value={v}
                  onChangeText={val=>{
                    handleOtpChange(val.slice(-1),i);
                  }}
                  keyboardType="numeric" maxLength={1} textAlign="center"/>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn,{width:'100%'}]} onPress={verifyOtp}>
              <Text style={styles.btnTxt}>CONFIRMER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{marginTop:14}} onPress={()=>{
              const code=String(Math.floor(100000+Math.random()*900000));
              setGeneratedOtp(code);
              Alert.alert('CODE RENVOYÉ',code);
            }}>
              <Text style={{color:'rgba(0,255,65,0.4)',fontFamily:'monospace',fontSize:11,letterSpacing:2}}>RENVOYER LE CODE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000'},
  scroll:{flexGrow:1,alignItems:'center',padding:20,paddingTop:70,paddingBottom:40},
  backBtn:{position:'absolute',top:20,left:20,borderWidth:1,borderColor:'rgba(0,255,65,0.2)',padding:8,paddingHorizontal:14},
  backTxt:{color:GREEN_DIM,fontFamily:'monospace',fontSize:11,letterSpacing:3},
  logoMini:{alignItems:'center',marginBottom:24},
  logoText:{color:GREEN,fontFamily:'monospace',fontSize:28,fontWeight:'900',letterSpacing:10,
    textShadowColor:'rgba(0,255,65,0.5)',textShadowOffset:{width:0,height:0},textShadowRadius:15},
  logoSub:{color:GREEN_DIM,fontFamily:'monospace',fontSize:10,letterSpacing:5,opacity:0.7,marginTop:5},

  progressWrap:{width:'100%',maxWidth:420,marginBottom:20},
  stepsRow:{flexDirection:'row',gap:8,justifyContent:'center',marginBottom:10},
  stepBadge:{paddingVertical:4,paddingHorizontal:10,borderWidth:1,borderColor:'rgba(0,255,65,0.15)'},
  stepActive:{borderColor:GREEN,backgroundColor:'rgba(0,255,65,0.1)'},
  stepDone:{backgroundColor:GREEN,borderColor:GREEN},
  stepTxt:{color:GREEN_DIM,fontFamily:'monospace',fontSize:10,letterSpacing:2},
  progressTrack:{height:2,backgroundColor:'rgba(0,255,65,0.12)',overflow:'hidden'},
  progressFill:{height:'100%',backgroundColor:GREEN},

  card:{width:'100%',maxWidth:420,backgroundColor:'rgba(0,8,2,0.95)',
    borderWidth:1,borderColor:'rgba(0,255,65,0.2)',padding:28,position:'relative'},
  corner:{position:'absolute',width:10,height:10,borderColor:GREEN,opacity:0.4},
  cTL:{top:8,left:8,borderTopWidth:1,borderLeftWidth:1},
  cTR:{top:8,right:8,borderTopWidth:1,borderRightWidth:1},
  cBL:{bottom:8,left:8,borderBottomWidth:1,borderLeftWidth:1},
  cBR:{bottom:8,right:8,borderBottomWidth:1,borderRightWidth:1},
  cardTitle:{color:GREEN_DIM,fontFamily:'monospace',fontSize:11,letterSpacing:4,marginBottom:22},

  row:{flexDirection:'row'},
  formGroup:{marginBottom:18},
  label:{color:GREEN_DIM,fontFamily:'monospace',fontSize:10,letterSpacing:3,marginBottom:8},
  input:{backgroundColor:'rgba(0,255,65,0.04)',borderWidth:1,borderColor:'rgba(0,255,65,0.18)',
    padding:13,color:GREEN,fontFamily:'monospace',fontSize:13,letterSpacing:1},
  dateRow:{flexDirection:'row',alignItems:'center',gap:6},
  dateSep:{color:GREEN_DIM,fontFamily:'monospace',fontSize:18},
  phoneRow:{flexDirection:'row',gap:8},
  countryBtn:{backgroundColor:'rgba(0,255,65,0.04)',borderWidth:1,borderColor:'rgba(0,255,65,0.18)',
    padding:13,justifyContent:'center'},
  countryTxt:{color:GREEN,fontFamily:'monospace',fontSize:13},
  passRow:{flexDirection:'row',alignItems:'center'},
  eyeBtn:{position:'absolute',right:10,padding:4},
  strengthBar:{height:2,backgroundColor:'rgba(0,255,65,0.1)',marginTop:6,overflow:'hidden'},
  strengthFill:{height:'100%',borderRadius:1},

  errorTxt:{color:RED,fontFamily:'monospace',fontSize:10,letterSpacing:2,marginBottom:12},
  btn:{backgroundColor:GREEN,padding:16,alignItems:'center',marginTop:8},
  btnTxt:{color:'#000',fontFamily:'monospace',fontSize:14,fontWeight:'700',letterSpacing:4},
  linkRow:{flexDirection:'row',justifyContent:'center',marginTop:20},
  linkTxt:{color:'rgba(0,255,65,0.4)',fontFamily:'monospace',fontSize:10,letterSpacing:2},

  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.88)',justifyContent:'center',alignItems:'center',padding:20},
  modalBox:{width:'100%',maxWidth:440,backgroundColor:'rgba(0,6,1,0.99)',borderWidth:1,borderColor:GREEN,maxHeight:'85%'},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.15)'},
  modalTitle:{color:GREEN,fontFamily:'monospace',fontSize:14,fontWeight:'900',letterSpacing:4},
  countryItem:{padding:14,borderBottomWidth:1,borderBottomColor:'rgba(0,255,65,0.07)'},
  countryItemTxt:{color:GREEN_DIM,fontFamily:'monospace',fontSize:13,letterSpacing:1},

  otpSub:{color:GREEN_DIM,fontFamily:'monospace',fontSize:11,letterSpacing:2,textAlign:'center',marginBottom:24,lineHeight:20},
  otpRow:{flexDirection:'row',gap:10,marginBottom:24},
  otpInput:{width:42,height:54,backgroundColor:'rgba(0,255,65,0.05)',borderWidth:1,borderColor:'rgba(0,255,65,0.3)',
    color:GREEN,fontFamily:'monospace',fontSize:22,fontWeight:'700'},
});

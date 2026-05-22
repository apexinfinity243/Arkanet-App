import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar
} from 'react-native';

const { width, height } = Dimensions.get('window');
const GREEN = '#00ff41';
const GREEN_DIM = '#00b32c';

// Matrix Rain Component
function MatrixRain() {
  const columns = Math.floor(width / 18);
  const drops = useRef(Array(columns).fill(0).map(() => Math.random() * height));
  const [chars, setChars] = useState([]);

  const matrixChars = 'アイウエオカキクケコ0123456789ABCDEF{}[]|~';

  useEffect(() => {
    const interval = setInterval(() => {
      const newChars = [];
      for (let i = 0; i < columns; i++) {
        const char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
        const bright = Math.random() > 0.95;
        newChars.push({
          key: `${i}-${Math.random()}`,
          x: i * 18,
          y: drops.current[i],
          char,
          bright,
        });
        drops.current[i] += 18;
        if (drops.current[i] > height && Math.random() > 0.975) {
          drops.current[i] = 0;
        }
      }
      setChars(newChars);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {chars.map(c => (
        <Text
          key={c.key}
          style={{
            position: 'absolute',
            left: c.x,
            top: c.y,
            color: c.bright ? '#ffffff' : (Math.random() > 0.7 ? GREEN : GREEN_DIM),
            fontSize: 13,
            fontFamily: 'monospace',
            opacity: 0.55,
          }}
        >
          {c.char}
        </Text>
      ))}
    </View>
  );
}

export default function WelcomeScreen({ navigation }) {
  const logoAnim  = useRef(new Animated.Value(0)).current;
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Logo fade in
    Animated.timing(logoAnim, {
      toValue: 1, duration: 900, useNativeDriver: true,
    }).start();

    // Card slide up
    Animated.timing(cardAnim, {
      toValue: 1, duration: 800, delay: 300, useNativeDriver: true,
    }).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <MatrixRain />

      {/* Scanlines overlay */}
      <View style={styles.scanlines} pointerEvents="none" />

      {/* Logo */}
      <Animated.View style={[styles.logoBlock, { opacity: logoAnim, transform: [{ translateY: logoAnim.interpolate({ inputRange:[0,1], outputRange:[-30,0] }) }] }]}>
        <Text style={styles.logoSub}>[ SYSTÈME SÉCURISÉ ]</Text>
        <Animated.Text style={[styles.logoText, { opacity: glowAnim }]}>ARKANET</Animated.Text>
        <Text style={styles.tagline}>RÉSEAU · CRYPTÉ · GLOBAL</Text>
      </Animated.View>

      {/* Card */}
      <Animated.View style={[styles.card, {
        opacity: cardAnim,
        transform: [{ translateY: cardAnim.interpolate({ inputRange:[0,1], outputRange:[40,0] }) }]
      }]}>
        {/* Corner decorations */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        <Text style={styles.cardTitle}>&gt; ACCÈS AU RÉSEAU</Text>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>CONNEXION</Text>
          <Text style={styles.btnSub}>Déjà membre du réseau</Text>
        </TouchableOpacity>

        <View style={{ height: 14 }} />

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: GREEN_DIM }]}>INSCRIPTION</Text>
          <Text style={[styles.btnSub, { color: GREEN_DIM }]}>Rejoindre Arkanet</Text>
        </TouchableOpacity>

        <Text style={styles.statusBar}>SYSTÈME EN LIGNE · AES-256 ▌</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#000', alignItems:'center', justifyContent:'center', padding:20 },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px)',
  },
  logoBlock: { alignItems:'center', marginBottom: 48 },
  logoSub: { color: GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:4, opacity:0.7, marginBottom:8 },
  logoText: {
    color: GREEN, fontFamily:'monospace', fontSize: 52, fontWeight:'900', letterSpacing:12,
    textShadowColor: 'rgba(0,255,65,0.6)', textShadowOffset:{width:0,height:0}, textShadowRadius:20,
  },
  tagline: { color: GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:6, opacity:0.7, marginTop:8 },

  card: {
    width:'100%', maxWidth:400,
    backgroundColor:'rgba(0,8,2,0.94)',
    borderWidth:1, borderColor:'rgba(0,255,65,0.22)',
    padding:36, position:'relative',
  },
  corner: { position:'absolute', width:12, height:12, borderColor:GREEN, borderStyle:'solid', opacity:0.5 },
  cornerTL: { top:8, left:8, borderTopWidth:1, borderLeftWidth:1 },
  cornerTR: { top:8, right:8, borderTopWidth:1, borderRightWidth:1 },
  cornerBL: { bottom:8, left:8, borderBottomWidth:1, borderLeftWidth:1 },
  cornerBR: { bottom:8, right:8, borderBottomWidth:1, borderRightWidth:1 },

  cardTitle: { color: GREEN_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:4, marginBottom:28 },

  btn: {
    borderWidth:1, borderColor: GREEN,
    padding:18, alignItems:'center',
    backgroundColor:'transparent',
  },
  btnSecondary: { borderColor:'rgba(0,255,65,0.3)' },
  btnText: { color: GREEN, fontFamily:'monospace', fontSize:14, fontWeight:'700', letterSpacing:4 },
  btnSub: { color: GREEN, fontFamily:'monospace', fontSize:10, letterSpacing:2, opacity:0.6, marginTop:3 },

  statusBar: {
    color: GREEN_DIM, fontFamily:'monospace', fontSize:10,
    letterSpacing:2, opacity:0.5, textAlign:'center', marginTop:28,
  },
});

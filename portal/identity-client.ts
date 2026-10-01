import { initializeApp } from 'firebase/app';
import { getAuth,setPersistence,browserSessionPersistence,signInWithEmailAndPassword,createUserWithEmailAndPassword,
 updateProfile,sendEmailVerification,sendPasswordResetEmail,confirmPasswordReset,signOut,signInWithPopup,
 GoogleAuthProvider,FacebookAuthProvider,OAuthProvider,SAMLAuthProvider,linkWithPopup,verifyBeforeUpdateEmail,
 getMultiFactorResolver,TotpMultiFactorGenerator,multiFactor,type MultiFactorResolver,type MultiFactorError,type TotpSecret } from 'firebase/auth';
const scriptOrigin=new URL(import.meta.url).origin;
let resolver:MultiFactorResolver|undefined,secret:TotpSecret|undefined;
const ready=(async()=>{
 const response=await fetch(scriptOrigin+'/sentinel/config',{credentials:'omit',redirect:'error'});
 const config=await response.json();if(!config.firebase)throw Error('NOT_CONFIGURED');
 const auth=getAuth(initializeApp(config.firebase,'resq-account'));await setPersistence(auth,browserSessionPersistence);await auth.authStateReady();return {auth,config};
})();
// Keep rejection handled until the user invokes a configured action.
void ready.catch(()=>{});
async function identity(){const {auth}=await ready;const user=auth.currentUser;if(!user)throw Error('SIGN_IN_REQUIRED');await user.reload();return {kind:'SignedIn',uid:user.uid,email:user.email,emailVerified:user.emailVerified,idToken:await user.getIdToken(true)};}
function provider(id:string,approved:string[]){
 if(id==='google.com')return new GoogleAuthProvider();if(id==='facebook.com')return new FacebookAuthProvider();
 if(['apple.com','microsoft.com'].includes(id))return new OAuthProvider(id);
 if(!approved.includes(id))throw Error('PROVIDER_NOT_APPROVED');
 return id.startsWith('saml.')?new SAMLAuthProvider(id):new OAuthProvider(id);
}
(window as unknown as {resqFirebase:(action:string,args:string)=>Promise<string>}).resqFirebase=async(action,args)=>{
 try{const data=JSON.parse(args),{auth,config}=await ready;
 switch(action){
 case 'signIn': await signInWithEmailAndPassword(auth,data.email,data.password);return JSON.stringify(await identity());
 case 'signUp': await createUserWithEmailAndPassword(auth,data.email,data.password);await updateProfile(auth.currentUser!,{displayName:data.name});return JSON.stringify(await identity());
 case 'provider': await signInWithPopup(auth,provider(data.provider,config.enterprise_providers));return JSON.stringify(await identity());
 case 'link': if(!auth.currentUser)throw Error('SIGN_IN_REQUIRED');await linkWithPopup(auth.currentUser,provider(data.provider,config.enterprise_providers));return JSON.stringify(await identity());
 case 'email': if(!auth.currentUser)throw Error('SIGN_IN_REQUIRED');await verifyBeforeUpdateEmail(auth.currentUser,data.email);break;
 case 'refresh':return JSON.stringify(await identity());
 case 'verify':if(!auth.currentUser)throw Error('SIGN_IN_REQUIRED');await sendEmailVerification(auth.currentUser);break;
 case 'reset':try{await sendPasswordResetEmail(auth,data.email);}catch{/* Same recovery response prevents enumeration. */}break;
 case 'confirmReset':await confirmPasswordReset(auth,data.code,data.password);break;
 case 'signOut':resolver=undefined;secret=undefined;await signOut(auth);break;
 case 'mfa':if(!resolver)throw Error('NO_PENDING_MFA');const hint=resolver.hints.find(h=>h.factorId===TotpMultiFactorGenerator.FACTOR_ID);if(!hint)throw Error('TOTP_REQUIRED');await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid,data.code));resolver=undefined;return JSON.stringify(await identity());
 case 'enrollStart':if(!auth.currentUser)throw Error('SIGN_IN_REQUIRED');secret=await TotpMultiFactorGenerator.generateSecret(await multiFactor(auth.currentUser).getSession());return JSON.stringify({kind:'Error',message:'Add this secret to your authenticator, then confirm its code: '+secret.secretKey});
 case 'enrollFinish':if(!secret||!auth.currentUser)throw Error('NO_PENDING_ENROLLMENT');await multiFactor(auth.currentUser).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret,data.code),'ResQ authenticator');secret=undefined;await signOut(auth);return JSON.stringify({kind:'Error',message:'Authenticator enrolled. Sign in again and enter its code.'});
 default:throw Error('UNSUPPORTED_ACTION');
 }return JSON.stringify({kind:'Completed'});
 }catch(error){if((error as {code?:string}).code==='auth/multi-factor-auth-required'){const {auth}=await ready;resolver=getMultiFactorResolver(auth,error as MultiFactorError);return JSON.stringify({kind:'Error',message:'Enter your authenticator code to complete sign-in.'});}
 return JSON.stringify({kind:'Error',message:'Identity request was not completed. Check configuration, sign-in method, recent authentication, or account recovery. Accounts are never merged automatically.'});}
};

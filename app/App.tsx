import {CloudDataPanel,useAutomaticCloudSync} from './src/cloud/CloudDataPanel';
import {BetaAccountPanel,BetaDashboard,useBetaAccount} from './src/cloud/BetaAccount';
import {betaAdminAccess,cloudConfig,submitBetaFeedback,setBetaAnalyticsConsent,trackBetaAnalytics} from './src/cloud/client';
import ActivePeptideEditor from './src/ActivePeptideEditor';
import {archivePlan} from './src/plan-actions-v04';
import NavIcon,{navColors,type NavGlyph} from './src/NavIcon';
import {EZPEP_LOCKUP_DATA_URI} from './src/brand-assets';
import ResearchPracticeCard from './src/ResearchPracticeCard';
import Svg,{Circle,Path} from 'react-native-svg';
import {researchPracticeFor,RESEARCH_PRACTICE_LABEL,RESEARCH_PRACTICE_NOTICE} from './src/research-practice';
import SetupPreview from './src/SetupPreview';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  BackHandler,
  AppState,
  Linking,
  Image,
  Platform,
  Share,
  useWindowDimensions,
  Modal,
} from "react-native";

import {library as compounds,searchLibrary as searchCompounds} from "./src/library-v04";
import QuickStart,{LearningPaths,SchoolBasics} from "./src/QuickStart";
import {SchoolAccordion,SchoolHighlights,RelatedSchoolCards,ResearchProductLink} from "./src/SchoolAccordion";
import {schoolSections,relatedSchool} from "./src/school-profile-v04";
import {beginActiveEdit,applyActiveEdit} from "./src/active-edit-v04";
import MyPlans from "./src/MyPlans";
import AggregateTracker from "./src/AggregateTracker";
import {getActivePlans} from "./src/multiplan-v04";
import {scopedPlanUpdate} from "./src/plan-actions-v04";
import type { Compound, PlanStage, PlanTemplate } from "./src/content";
import Workspace from "./src/Workspace";
import { usePlannerStore } from "./src/store";
import type { ActiveEdit, Draft, Store } from "./src/engine";
import { importReference, newDraft } from "./src/engine";
import { Evidence, ProfessorHelp } from "./src/ui";
import { reconcileReminders, listenForReminder } from "./src/reminders";
import type { PlanMode } from "./src/planning";
import {decodePlannerStore,encodePlannerStore,previewPeptideLibraryCsv,externalSetups,externalSetupErrors,importReadyExternalPeptides,type ExternalCsvPreview,type ExternalPeptideSetup} from "./src/persistence-v04";
type Experience = "new" | "familiar" | "experienced";
type FirstGoal = "learn" | "research" | "setup" | "track";
type OnboardingProfile = { experience: Experience; goal: FirstGoal };
type Screen = "welcome" | "activeEditor" | "profile" | "settings" | "betaFeedback" | "betaPrivacy" | "betaDashboard" | "shop" | "plans" | "planInventory" | "planDetail" | "planTracker" | "planHistory" | "school" | "schoolDetail" | "schoolMore" | "schoolSources" | "guide" | "detail" | "plan" | "calc" | "tracker" | "review" | "schedule" | "inventory" | "reminders" | "history" | "dataImport" | "more";

const COLORS = {
  ink: "#0E1C4A",
  muted: "#667597",
  blue: "#27B9EE",
  purple: "#7557F6",
  border: "#DDE8F6",
  pale: "#F7FBFF",
  paleBlue: "#EAF9FF",
  palePurple: "#F2EDFF",
  white: "#FFFFFF",
};

const plannerChangedAt=(store:Store)=>{
  const values:string[]=[];
  for(const plan of [...getActivePlans(store),...store.archives]){
    values.push(plan.activatedAt,plan.pausedAt||'');
    for(const revision of plan.revisions??[])values.push(revision.changedAt);
    for(const entry of plan.inventoryLedger??[])values.push(entry.at);
    for(const event of plan.events)values.push(event.completedAt||'',event.skippedAt||'');
  }
  const times=values.map(value=>Date.parse(value)).filter(Number.isFinite);
  return times.length?new Date(Math.max(...times)).toISOString():null;
};
const backupDateLabel=(value:string|null)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not recorded in this older backup';


function AppButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled&&{opacity:.55}, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function Molecule({ color = COLORS.blue }: { color?: string }) {
  return (
    <View style={styles.molecule}>
      <View style={[styles.atom, { backgroundColor: color, left: 29, top: 4 }]} />
      <View style={[styles.atomSmall, { backgroundColor: color, left: 5, top: 29 }]} />
      <View style={[styles.atomSmall, { backgroundColor: color, left: 50, top: 31 }]} />
      <View style={[styles.atomTiny, { backgroundColor: color, left: 29, top: 54 }]} />
      <View style={[styles.bond, { backgroundColor: color, transform: [{ rotate: "-45deg" }], left: 14, top: 24 }]} />
      <View style={[styles.bond, { backgroundColor: color, transform: [{ rotate: "45deg" }], left: 35, top: 24 }]} />
      <View style={[styles.bondVertical, { backgroundColor: color, left: 33, top: 38 }]} />
    </View>
  );
}

function BottomNav({ active, setScreen }: { active: Screen; setScreen: (s: Screen) => void }) {
  const items: { key: NavGlyph; label: string }[] = [
    { key: "school", label: "Learn" },
    { key: "guide", label: "Build Plan" },
    { key: "tracker", label: "TODAY" },
    { key: "plans", label: "My Peptides" },
    { key: "more", label: "More" },
  ];
  return (
    <View testID="bottom-navigation" style={styles.nav}>
      {items.map((item) => {
        const tab = active === "schoolDetail" || active === "schoolMore" || active === "schoolSources" ? "school" : active === "detail" ? "guide" : ["plan", "planDetail", "planInventory", "calc", "review", "schedule"].includes(active) ? "plans" : ["history","planTracker","planHistory"].includes(active) ? "tracker" : ["inventory", "reminders","profile","settings"].includes(active) ? "more" : active;
        const isActive = tab === item.key;
        return (
          <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: isActive }} key={item.key} onPress={() => setScreen(item.key)} style={styles.navItem}>
            <View testID={item.key==='tracker'?'today-center-button':undefined} style={[styles.navArtWell,item.key==='tracker'&&styles.todayArtWell,isActive&&styles.navArtWellSelected]}><NavIcon name={item.key} color={navColors[item.key]} size={item.key==='tracker'?58:48}/></View>
            <Text style={[styles.navLabel,{color:navColors[item.key],fontWeight:isActive||item.key==='tracker'?'800':'600'}]}>{item.key==='tracker'?'Today':item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function App() {
  const betaAccount=useBetaAccount();
  const [feedbackSubmitting,setFeedbackSubmitting]=useState(false);
  const {width:viewportWidth}=useWindowDimensions();
  const compactLayout=viewportWidth<600;
  const [screen, setScreen] = useState<Screen>("welcome");
  const [selected, setSelected] = useState<Compound>(compounds[0]);
  const [query,setQuery] = useState("");
  const [schoolQuery,setSchoolQuery] = useState("");
  const [schoolSection,setSchoolSection] = useState<"library"|"courses"|"facts"|"community">("library");
  const [schoolFilter,setSchoolFilter] = useState<"all"|"favorites"|"human"|"preclinical"|"blends">("all");
  const [schoolFavorites,setSchoolFavorites] = useState<string[]>([]);
  const [feedbackType,setFeedbackType]=useState<'Bug'|'Confusing'|'Suggestion'|'Calculation concern'>('Bug');
  const [feedbackText,setFeedbackText]=useState('');
  const [feedbackOrigin,setFeedbackOrigin]=useState('More');
  const [feedbackIncludePlans,setFeedbackIncludePlans]=useState(false);
  const [feedbackMessage,setFeedbackMessage]=useState('');
  const [betaConsentAt,setBetaConsentAt]=useState<string|null>(null);
  const [betaConsentChecked,setBetaConsentChecked]=useState(false);
  const [analyticsConsent,setAnalyticsConsent]=useState(false);
  const [betaAdmin,setBetaAdmin]=useState(false);
  const analyticsSessionTracked=useRef(false);
  const trackedPlanCount=useRef<number|null>(null);
  useEffect(()=>{AsyncStorage.getItem('pepplan.beta-consent.v1').then(value=>setBetaConsentAt(value||null)).catch(()=>{});},[]);
  useEffect(()=>{
    if(betaAccount.state.status!=='eligible'){setBetaAdmin(false);return;}
    betaAdminAccess().then(setBetaAdmin).catch(()=>setBetaAdmin(false));
  },[betaAccount.state.status,betaAccount.state.userId]);
  useEffect(()=>{
    if(betaAccount.state.status!=='eligible'){setAnalyticsConsent(false);analyticsSessionTracked.current=false;return;}
    setBetaAnalyticsConsent(true).then(()=>setAnalyticsConsent(true)).catch(()=>setAnalyticsConsent(false));
  },[betaAccount.state.status,betaAccount.state.userId]);
  useEffect(()=>{
    if(betaAccount.state.status!=='eligible'||!analyticsConsent)return;
    if(!analyticsSessionTracked.current){analyticsSessionTracked.current=true;void trackBetaAnalytics('session_started');}
    void trackBetaAnalytics('screen_viewed',screen);
    if(screen==='guide')void trackBetaAnalytics('plan_builder_started');
  },[betaAccount.state.status,betaAccount.state.userId,analyticsConsent,screen]);
  useEffect(()=>{
    if(betaAccount.state.status!=='eligible'||!analyticsConsent)return;
    let startedAt=Date.now(),measuring=true;
    const flush=()=>{if(!measuring)return;measuring=false;const seconds=Math.floor((Date.now()-startedAt)/1000);if(seconds>=1)void trackBetaAnalytics('screen_time',screen,seconds);};
    const subscription=AppState.addEventListener('change',next=>{if(next==='active'){startedAt=Date.now();measuring=true;}else flush();});
    return()=>{flush();subscription.remove();};
  },[betaAccount.state.status,betaAccount.state.userId,analyticsConsent,screen]);
  useEffect(()=>{AsyncStorage.getItem("pepplan.school.favorites").then(value=>{if(value)setSchoolFavorites(JSON.parse(value));}).catch(()=>{});},[]);
  const toggleSchoolFavorite=(id:string)=>setSchoolFavorites(current=>{const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];AsyncStorage.setItem("pepplan.school.favorites",JSON.stringify(next)).catch(()=>{});return next;});

  const saved = usePlannerStore();
  const [cloudGuideOpen,setCloudGuideOpen]=useState(false);
  useEffect(()=>{
    if(betaAccount.state.status!=='eligible'||!saved.ready)return;
    const key='pepplan.cloud-guide.seen.v1:'+betaAccount.state.userId;
    AsyncStorage.getItem(key).then(value=>{if(!value)setCloudGuideOpen(true);}).catch(()=>{});
  },[betaAccount.state.status,betaAccount.state.userId,saved.ready]);
  const closeCloudGuide=()=>{setCloudGuideOpen(false);if(betaAccount.state.status==='eligible')AsyncStorage.setItem('pepplan.cloud-guide.seen.v1:'+betaAccount.state.userId,'seen').catch(()=>{});};
  const cloudSync=useAutomaticCloudSync({eligible:betaAccount.state.status==='eligible',userId:betaAccount.state.userId??null,store:saved.store,ready:saved.ready&&!saved.loadFailed&&!saved.error,saving:saved.saving,replaceStore:saved.recover,onNeedsAttention:()=>setCloudGuideOpen(true)});
  const [onboarding,setOnboarding]=useState<OnboardingProfile|null|undefined>(undefined);
  const [experience,setExperience]=useState<Experience|null>(null);
  const [firstGoal,setFirstGoal]=useState<FirstGoal|null>(null);
  const [restartingOnboarding,setRestartingOnboarding]=useState(false);
  useEffect(()=>{AsyncStorage.getItem("pepplan.onboarding.v1").then(value=>setOnboarding(value?JSON.parse(value):null)).catch(()=>setOnboarding(null));},[]);
  const onboardingDestination=(goal:FirstGoal):Screen=>goal==="learn"||goal==="research"?"school":"guide";
  const finishOnboarding=(profile:OnboardingProfile,destination?:Screen)=>{const acceptedAt=new Date().toISOString();setRestartingOnboarding(false);setOnboarding(profile);setBetaConsentAt(acceptedAt);AsyncStorage.multiSet([["pepplan.onboarding.v1",JSON.stringify(profile)],["pepplan.beta-consent.v1",acceptedAt]]).catch(()=>{});if(analyticsConsent)void trackBetaAnalytics("onboarding_completed");setScreen(destination??onboardingDestination(profile.goal));};
  const confirmSkipOnboarding=()=>Alert.alert(
    "Skip Quick Start?",
    "Skipping the questions continues into EZPep and accepts the beta terms and limited usage analytics described on this screen. You can restart Quick Start from More → Preferences.",
    [
      {text:"Keep going",style:"cancel"},
      {text:"Skip for now",onPress:()=>finishOnboarding({experience:"familiar",goal:"setup"},"tracker")},
    ],
  );
  const restartOnboarding=()=>Alert.alert(
    "Restart Quick Start?",
    "This will reopen the welcome questions. Your saved plans, history and settings will not be changed.",
    [
      {text:"Cancel",style:"cancel"},
      {text:"Restart",onPress:()=>{setRestartingOnboarding(true);setExperience(null);setFirstGoal(null);setOnboarding(null);AsyncStorage.removeItem("pepplan.onboarding.v1").catch(()=>{});setScreen("welcome");}},
    ],
  );
  const exportLocalBackup=async()=>{
    const exportedAt=new Date().toISOString(),plannerUpdatedAt=plannerChangedAt(saved.store);
    const payload=JSON.stringify({kind:'ezpep-planner-backup',backupVersion:1,exportedAt,plannerUpdatedAt,store:JSON.parse(encodePlannerStore(saved.store))});
    const filename="ezpep-planner-backup-"+exportedAt.replace(/[:.]/g,'-')+".json";
    try{
      if(Platform.OS==="web"){
        const web=globalThis as any;
        const url=web.URL.createObjectURL(new web.Blob([payload],{type:"application/json"}));
        const link=web.document.createElement("a");
        link.href=url;link.download=filename;link.click();
        web.URL.revokeObjectURL(url);
        Alert.alert("Backup downloaded","Keep this file private. It contains the plans and history saved in this browser.");
      }else{
        await Share.share({title:"EZPep Planner backup",message:payload});
      }
    }catch{
      Alert.alert("Backup not created","Your saved plans were not changed. Please try again.");
    }
  };
  const [restoreCandidate,setRestoreCandidate]=useState<{store:Store;plans:number;archives:number;history:number;fileName:string;fileSavedAt:string|null;plannerUpdatedAt:string|null}|null>(null);
  const [restoringBackup,setRestoringBackup]=useState(false),[restoreStatus,setRestoreStatus]=useState('');
  const chooseBackupFile=()=>{
    if(Platform.OS!=='web'){Alert.alert('Restore backup','Backup-file restore is available in the private web beta. Native file selection will be added for the Android beta.');return;}
    const web=globalThis as any,input=web.document.createElement('input');
    input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const raw=await file.text(),value=JSON.parse(raw),wrapped=value?.kind==='ezpep-planner-backup'&&value?.store;const store=decodePlannerStore(wrapped?JSON.stringify(value.store):raw),all=[...getActivePlans(store),...store.archives];setRestoreStatus('');setRestoreCandidate({store,plans:getActivePlans(store).length,archives:store.archives.length,history:all.reduce((n,plan)=>n+plan.events.filter(event=>event.status!=='pending').length,0),fileName:file.name,fileSavedAt:wrapped&&typeof value.exportedAt==='string'?value.exportedAt:(file.lastModified?new Date(file.lastModified).toISOString():null),plannerUpdatedAt:wrapped&&typeof value.plannerUpdatedAt==='string'?value.plannerUpdatedAt:plannerChangedAt(store)});}catch(error){Alert.alert('Backup not accepted',String(error).replace(/^Error:\s*/,''));}};
    input.click();
  };
  const restoreLocalBackup=async()=>{
    if(!restoreCandidate||restoringBackup)return;
    setRestoringBackup(true);setRestoreStatus('Creating a safety copy…');
    try{
      const keys=await AsyncStorage.getAllKeys(),old=keys.filter(key=>key.startsWith('peptide-planner:pre-restore:')&&key!=='peptide-planner:pre-restore:last-good');
      if(old.length)await AsyncStorage.multiRemove(old);
      await AsyncStorage.setItem('peptide-planner:pre-restore:last-good',encodePlannerStore(saved.store));
      setRestoreStatus('Restoring the selected backup…');
      await saved.recover(restoreCandidate.store);
      setSelectedPlanId(null);setRestoreStatus('Backup restored successfully. The selected planner is now active on this device.');
    }catch(error){setRestoreStatus('Backup was not restored. Your current planner is unchanged. '+String(error).replace(/^Error:\s*/,''));}
    finally{setRestoringBackup(false);}
  };
  const [importText,setImportText]=useState('');
  const [importPreview,setImportPreview]=useState<ExternalCsvPreview|null>(null);
  const [importError,setImportError]=useState('');
  const [importSetups,setImportSetups]=useState<ExternalPeptideSetup[]>([]);
  const [importResult,setImportResult]=useState('');
  const [importSummary,setImportSummary]=useState('');
  const [importing,setImporting]=useState(false);
  const changeImportSetup=(key:string,patch:Partial<ExternalPeptideSetup>)=>setImportSetups(current=>current.map(item=>item.key===key?{...item,...patch}:item));
  const executeReadyImports=async(ready:ExternalPeptideSetup[])=>{
    if(!importPreview||importing)return;
    setImporting(true);setImportResult('Importing…');setImportError('');
    try{
      await AsyncStorage.setItem('peptide-planner:pre-import:'+new Date().toISOString(),encodePlannerStore(saved.store));
      let report:any=null;
      await saved.update(old=>{report=importReadyExternalPeptides(old,importPreview,ready,new Date());return report.store;});
      const total=report.activeCreated+report.archivedCreated;
      const summary=total+' '+(total===1?'peptide':'peptides')+' imported · '+report.activeCreated+' active · '+report.archivedCreated+' archived · '+report.historyAdded+' history entries added'+(report.duplicatesSkipped?' · '+report.duplicatesSkipped+' duplicate skipped':'');
      setImportResult(summary);setImportSummary(summary);
      if(analyticsConsent===true)void trackBetaAnalytics('import_completed');
      setImportPreview(null);setImportSetups([]);setImportText('');
    }catch(error){setImportResult('');setImportError('Import was not completed. '+String(error).replace(/^Error:\s*/,''));}
    finally{setImporting(false);}
  };
  const confirmReadyImports=()=>{
    if(!importPreview||importing)return;
    const ready=importSetups.filter(item=>item.selected&&!externalSetupErrors(item).length),blocked=importSetups.filter(item=>item.selected&&externalSetupErrors(item).length);
    if(!ready.length){setImportError('Complete the highlighted fields on at least one selected peptide.');return;}
    if(Platform.OS==='web'){void executeReadyImports(ready);return;}
    Alert.alert('Import '+ready.length+' ready '+(ready.length===1?'peptide':'peptides')+'?',(blocked.length?blocked.length+' selected peptide card(s) will remain unimported until their highlighted fields are complete. ':'')+'Existing plans and history will not be replaced.',[
      {text:'Cancel',style:'cancel'},
      {text:'Import ready peptides',onPress:()=>{void executeReadyImports(ready);}},
    ]);
  };
  const previewImport=(text:string)=>{
    setImportText(text);
    try{const preview=previewPeptideLibraryCsv(text);setImportPreview(preview);setImportSetups(externalSetups(preview));setImportResult('');setImportError('');}
    catch(error){setImportPreview(null);setImportError(String(error).replace(/^Error:\s*/,''));}
  };
  const chooseImportFile=()=>{
    if(Platform.OS!=='web'){setScreen('dataImport');return;}
    const web=globalThis as any,input=web.document.createElement('input');
    input.type='file';input.accept='.csv,text/csv';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;previewImport(await file.text());setScreen('dataImport');};
    input.click();
  };
  const [selectedPlanId,setSelectedPlanId]=useState<string|null>(null);
  const [editingActive,setEditingActive]=useState(false);
  const [sessionEdit,setSessionEdit]=useState<ActiveEdit|null>(null);
  const [editorSection,setEditorSection]=useState('');
  const [editError,setEditError]=useState('');
 const [discardEdits,setDiscardEdits]=useState(false);
  const currentEdit=saved.store.activeEdit??sessionEdit;
  const editing=editingActive&&!!currentEdit&&['activeEditor','plan','review','schedule','calc'].includes(screen);
  const plans=getActivePlans(saved.store);
  useEffect(()=>{
    if(!saved.ready){trackedPlanCount.current=null;return;}
    if(trackedPlanCount.current===null){trackedPlanCount.current=plans.length;return;}
    if(plans.length>trackedPlanCount.current&&analyticsConsent===true)void trackBetaAnalytics('plan_started');
    trackedPlanCount.current=plans.length;
  },[saved.ready,plans.length,analyticsConsent]);
  const focused=plans.find(p=>p.id===selectedPlanId)??saved.store.archives.find(p=>p.id===selectedPlanId)??plans[0]??null;
  const scopedStore={...saved.store,active:focused,draft:editing?currentEdit!.draft:screen==='planDetail'?null:saved.store.draft};
  const persistEdit=(edit:ActiveEdit)=>saved.update(old=>({...old,activeEdit:edit})).then(()=>setSessionEdit(null));
  const scopedUpdate=(change:Parameters<typeof saved.update>[0])=>saved.update(old=>{const edit=old.activeEdit??sessionEdit;if(editing&&edit){const changed=change({...old,active:focused,draft:edit.draft});return {...old,activeEdit:{...edit,draft:changed.draft!}};}const next=scopedPlanUpdate(old,focused?.id??null,change);if(getActivePlans(next).length>getActivePlans(old).length)setSelectedPlanId(getActivePlans(next).at(-1)!.id);return next;}).then(()=>{if(editing&&sessionEdit)setSessionEdit(null);});
  const openPlan=(id:string)=>{setEditingActive(false);setSelectedPlanId(id);setScreen('planDetail');};
  const editPlan=(id:string,section='')=>{
   const plan=plans.find(p=>p.id===id);if(!plan)return;
   if(saved.store.activeEdit&&saved.store.activeEdit.planId!==id){setEditError('Finish or discard the existing plan edits first.');return;}
   setSessionEdit(saved.store.activeEdit?null:{...beginActiveEdit(plan),returnTo:screen==='tracker'||screen==='history'||screen==='planTracker'||screen==='planHistory'?'tracker':screen==='planDetail'?'planDetail':'plans'});
   setSelectedPlanId(id);setEditingActive(true);setEditorSection(section);setScreen('activeEditor');setEditError('');
  };
  const saveActiveEdits=async()=>{const target=currentEdit?.returnTo??'plans';if(saved.store.activeEdit)await saved.update(old=>old.activeEdit?applyActiveEdit(old,old.activeEdit):old);setSessionEdit(null);setEditingActive(false);setScreen(target);};
  const discardActiveEdits=async()=>{const target=currentEdit?.returnTo??'plans';if(saved.store.activeEdit)await saved.update(old=>({...old,activeEdit:null}));setSessionEdit(null);setEditingActive(false);setScreen(target);setEditError('');};
  useEffect(()=>{if(!['activeEditor','plan','review','schedule','calc'].includes(screen)){setEditingActive(false);setSessionEdit(null);}},[screen]);
  const workspaceNavigate=(target:any)=>{if(target==='back'&&screen==='planHistory'){if(Platform.OS==='web'&&(globalThis as any).history?.state?.ezpepScreen==='planHistory')(globalThis as any).history.back();else setScreen('plans');}else if(target==='tracker'){setScreen('planTracker');}else if(target==='inventory'&&focused)editPlan(focused.id,'Inventory');else setScreen(target);};
  const [reminderError,setReminderError] = useState("");
  const filtered=searchCompounds(query);
  const schoolResults=useMemo(()=>searchCompounds(schoolQuery).filter(c=>{
    const evidence=(c.supplied?.evidenceBadge??"").toLowerCase();
    if(schoolFilter==="favorites")return schoolFavorites.includes(c.id);
    if(schoolFilter==="human")return evidence.includes("human")||evidence.includes("approved");
    if(schoolFilter==="preclinical")return evidence.includes("preclinical");
    if(schoolFilter==="blends")return evidence.includes("blend");
    return true;
  }),[schoolQuery,schoolFilter,schoolFavorites]);
  const openCompound=(compound:Compound)=>{setSelected(compound);setScreen("detail");};
  const openSchool=(compound:Compound)=>{setSelected(compound);setScreen("schoolDetail");};
  const [replacement,setReplacement]=useState<{draft:Draft;target:Screen}|null>(null);
  const chooseDraft=(draft:Draft,target:Screen)=>{if(saved.store.draft){setReplacement({draft,target});return;}saved.update(old=>({...old,draft})).then(()=>setScreen(target)).catch(()=>{});};
  const startPlan=(mode:PlanMode="staged")=>{setEditingActive(false);chooseDraft(newDraft(selected,mode),"plan");};
  const copySchoolPlan=(template?:PlanTemplate)=>{
    try {setEditingActive(false);const draft=importReference(selected,template);chooseDraft(draft,"review");} catch(e){Alert.alert("Reference",String(e));}
  };
  useEffect(()=>{
    const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(screen==='activeEditor'){discardActiveEdits().catch(()=>{});return true;}
      const parent:Partial<Record<Screen,Screen>>={plans:"guide",planDetail:"plans",planInventory:"planDetail",planTracker:"planDetail",planHistory:"plans",dataImport:"settings",betaFeedback:"more",betaPrivacy:"more",schoolSources:"schoolMore",schoolMore:"schoolDetail",schoolDetail:"school",detail:"guide",plan:"detail",review:"calc",schedule:"plan",calc:"schedule",tracker:"plan",inventory:"more",reminders:"more",history:"tracker"};
      if(!parent[screen])return false;setScreen(parent[screen]!);return true;
    });return()=>subscription.remove();
  },[screen]);
  useEffect(()=>{
    if(Platform.OS!=='web'||screen!=='planHistory')return;
    const web=globalThis as any;
    web.history.pushState({...web.history.state,ezpepScreen:'planHistory'},'',web.location.href);
    const back=()=>setScreen('plans');
    web.addEventListener('popstate',back);
    return()=>web.removeEventListener('popstate',back);
  },[screen]);
  useEffect(()=>{
    if(!saved.ready||saved.loadFailed)return;
    let mounted=true;const sync=()=>reconcileReminders(plans).then(()=>{if(mounted)setReminderError("");}).catch(e=>{if(mounted)setReminderError("Reminders need attention. Open More → Reminders. "+String(e));});
    sync();const sub=AppState.addEventListener("change",state=>{if(state==="active")sync();});return()=>{mounted=false;sub.remove();};
  },[saved.ready,saved.store.activePlans,saved.loadFailed]);
  useEffect(()=>listenForReminder((planId)=>{if(planId)setSelectedPlanId(planId);setScreen("tracker");}),[]);
  useEffect(()=>{
    if(!saved.ready||screen!=="welcome"||onboarding===undefined||restartingOnboarding)return;
    if(onboarding){setScreen("tracker");return;}
    if(plans.length||saved.store.draft){const profile:OnboardingProfile={experience:plans.length?"experienced":"familiar",goal:plans.length?"track":"setup"};setOnboarding(profile);AsyncStorage.setItem("pepplan.onboarding.v1",JSON.stringify(profile)).catch(()=>{});setScreen("tracker");}
  },[saved.ready,onboarding,plans.length,restartingOnboarding,saved.store.draft]);

  const renderWelcome=()=>(
    <ScrollView contentContainerStyle={styles.welcomeContent}>
      <View style={styles.welcomeBrand}><Image accessibilityLabel="EZPep Planner" source={{uri:EZPEP_LOCKUP_DATA_URI}} resizeMode="contain" style={styles.welcomeBrandImage}/></View>
      <Text style={styles.kicker}>WELCOME TO EZPEP PLANNER</Text>
      <Text style={styles.welcomeTitle}>A clearer place to begin.</Text>
      <Text style={styles.welcomeSub}>Tell us where you are starting. This changes the guidance you see—not your calculations or available features.</Text>
      <View style={styles.professorWelcomeCard}><Image accessibilityLabel="Professor Lynch" source={require("./assets/professor-lynch-checklist.webp")} resizeMode="contain" style={styles.professorWelcomeAvatar}/><View style={styles.professorWelcomeBubble}><View style={styles.professorBubbleTail}/><Text style={styles.professorName}>HI, I’M PROFESSOR LYNCH</Text><Text style={styles.professorMessage}>I’m here to give you a clearer, guided way to learn the basics and organize your peptide research plans.</Text></View></View>
      <Text style={styles.onboardingQuestion}>How familiar are you with peptides?</Text>
      <View style={styles.choiceStack}>{([
        ["new","I’m new","Show the essentials and explain each step."],
        ["familiar","I know the basics","Keep guidance available without slowing setup."],
        ["experienced","I’m experienced","Lead with the fastest planning path."]
      ] as const).map(([value,label,detail])=><Pressable accessibilityRole="radio" accessibilityState={{selected:experience===value}} key={value} onPress={()=>setExperience(value)} style={[styles.choiceCard,experience===value&&styles.choiceCardSelected]}><View style={[styles.radio,experience===value&&styles.radioSelected]}/><View style={{flex:1}}><Text style={styles.choiceTitle}>{label}</Text><Text style={styles.choiceDetail}>{detail}</Text></View></Pressable>)}</View>
      <Text style={styles.onboardingQuestion}>What would you like to do first?</Text>
      <View style={styles.goalGrid}>{([
        ["learn","Learn the basics"],["research","Research a peptide"],["setup","Set up an existing routine"],["track","Track a routine underway"]
      ] as const).map(([value,label])=><Pressable accessibilityRole="radio" accessibilityState={{selected:firstGoal===value}} key={value} onPress={()=>setFirstGoal(value)} style={[styles.goalCard,firstGoal===value&&styles.goalCardSelected]}><Text style={[styles.goalText,firstGoal===value&&styles.goalTextSelected]}>{label}</Text></Pressable>)}</View>
      <View style={styles.notice}><Text style={styles.noticeText}>By continuing, you accept the private beta terms and limited product analytics used to measure sessions, feature use and time spent by app area. Planner content—including peptide names, doses, schedules, calculations, inventory, history and notes—is not included.</Text></View>
      {experience&&firstGoal&&<AppButton label="Accept and show me where to begin" onPress={()=>finishOnboarding({experience,goal:firstGoal})}/>}
      <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={confirmSkipOnboarding} style={styles.skipButton}><Text style={styles.crossLinkText}>Skip for now</Text></Pressable>
      <Text style={styles.onboardingSafety}>EZPep Planner organizes educational research information and routines you enter. It does not select a peptide or prescribe a dose.</Text>
    </ScrollView>
  );

  const renderStartHere=()=>{
    const newUser=onboarding?.experience==="new";
    const draft=saved.store.draft;
    const recommended=onboarding?.goal==="learn"?0:onboarding?.goal==="research"?1:2;
    const steps=[
      {n:"1",title:"Learn the essentials",detail:newUser?"Start with terminology, storage and reconstitution concepts.":"Review fundamentals whenever you need them.",action:()=>setScreen("school"),label:"Open Learn"},
      {n:"2",title:"Research a peptide",detail:"Review key facts, evidence, warnings and references.",action:()=>setScreen("school"),label:"Browse the library"},
      {n:"3",title:draft?"Continue your plan":"Build your plan",detail:draft?draft.compoundName+" setup is waiting for you.":"Choose a peptide and enter the routine you want to track.",action:()=>setScreen(draft?"plan":"guide"),label:draft?"Continue setup":"Choose a peptide"},
      {n:"4",title:"Review calculations",detail:"Confirm vial strength, diluent, concentration and syringe display inside the guided setup."},
      {n:"5",title:"Start tracking",detail:"Starting the plan creates Today, reminders and inventory forecasting."}
    ];
    return <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.startHero}><View style={styles.startHeroCopy}><Text style={styles.kicker}>START HERE WITH PROFESSOR LYNCH</Text><Text style={styles.welcomeTitle}>{draft?"Continue where you left off.":"Learn. Plan. Track."}</Text><Text style={styles.welcomeSub}>{newUser?"I’ll explain the essentials as you go.":"A simple path from research to a working daily schedule."}</Text></View><View style={[styles.guideSpeechBubble,compactLayout&&styles.guideSpeechBubbleCompact]}><View style={styles.guideSpeechTail}/><Text style={styles.schoolSpeechText}>{draft?"Let’s pick up where you left off. Your saved setup is ready.":"Start wherever you feel comfortable—I’ll keep the next step clear."}</Text></View><Image accessibilityLabel="Professor Lynch guide" source={require("./assets/professor-lynch-pointing-right.webp")} resizeMode="contain" style={[styles.professorStartGuide,compactLayout&&styles.professorStartGuideCompact]}/></View>
      <View style={styles.pathLine}/>
      {steps.map((step,index)=><View key={step.n} style={[styles.startStep,draft&&index<2&&styles.startStepQuiet,index===recommended&&styles.startStepRecommended]}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{step.n}</Text></View><View style={{flex:1}}>{index===recommended&&<Text style={styles.sourceClass}>RECOMMENDED FIRST</Text>}<Text style={styles.lessonTitle}>{step.title}</Text><Text style={styles.nextText}>{step.detail}</Text>{step.action&&<Pressable accessibilityRole="button" accessibilityLabel={step.label} onPress={step.action} style={styles.inlineAction}><Text style={styles.crossLinkText}>{step.label} →</Text></Pressable>}</View></View>)}
      <Text style={styles.onboardingSafety}>You can move between Learn and Build Plan at any time. Your navigation stays the same after setup.</Text>
    </ScrollView>;
  };

  const renderSchool = () => (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View accessibilityRole="tablist" style={styles.schoolTabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:schoolSection==="library"}} onPress={()=>setSchoolSection("library")} style={[styles.schoolTab,schoolSection==="library"&&styles.schoolTabActive]}><Text numberOfLines={1} style={[styles.schoolTabText,schoolSection==="library"&&styles.schoolTabTextActive]}>Library</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:schoolSection==="courses"}} onPress={()=>setSchoolSection("courses")} style={[styles.schoolTab,schoolSection==="courses"&&styles.schoolTabActive]}><Text numberOfLines={1} style={[styles.schoolTabText,schoolSection==="courses"&&styles.schoolTabTextActive]}>Courses</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:schoolSection==="facts"}} onPress={()=>setSchoolSection("facts")} style={[styles.schoolTab,schoolSection==="facts"&&styles.schoolTabActive]}><Text numberOfLines={1} style={[styles.schoolTabText,schoolSection==="facts"&&styles.schoolTabTextActive]}>Quick Facts</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:schoolSection==="community"}} onPress={()=>setSchoolSection("community")} style={[styles.schoolTab,schoolSection==="community"&&styles.schoolTabActive]}><Text numberOfLines={1} style={[styles.schoolTabText,schoolSection==="community"&&styles.schoolTabTextActive]}>Community</Text></Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroBubbleOne} /><View style={styles.heroBubbleTwo} />
          <View style={[styles.schoolHeroCopy,compactLayout&&styles.schoolHeroCopyCompact]}><Text style={styles.kicker}>PEP SCHOOL · WITH PROFESSOR LYNCH</Text><Text style={[styles.heroTitle,compactLayout&&styles.schoolHeroTitleCompact]}>A clearer place{"\n"}to begin.</Text><Text style={styles.heroSub}>Choose one learning area at a time.</Text></View>
          <View style={[styles.schoolSpeechBubble,compactLayout&&styles.schoolSpeechBubbleCompact]}><View style={styles.schoolSpeechTail}/><Text style={styles.schoolSpeechText}>Welcome! Pick a section and we’ll take it one clear step at a time.</Text></View>
          <Image accessibilityLabel="Professor Lynch welcoming you to Pep School" source={require("./assets/professor-lynch-thinking.webp")} resizeMode="contain" style={[styles.professorSchoolHero,compactLayout&&styles.professorSchoolHeroCompact]}/>
        </View>


        {schoolSection==="library"&&<>
          <View style={styles.schoolSectionIntro}><Text style={styles.kicker}>THE 101 LIBRARY</Text><Text style={styles.sectionTitle}>Research by peptide</Text><Text style={styles.helper}>Beginner introductions, evidence classes and primary sources—kept separate from courses and app help.</Text></View>
          <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text>
            <TextInput accessibilityLabel="Search Pep School" value={schoolQuery} onChangeText={setSchoolQuery} placeholder="Name, alias or abbreviation" style={styles.searchInput} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schoolFilters}>{([
            ["all","All"],["favorites","★ Favorites"],["human","Human evidence"],["preclinical","Preclinical"],["blends","Blends"]
          ] as const).map(([key,label])=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:schoolFilter===key}} onPress={()=>setSchoolFilter(key)} style={[styles.schoolFilter,schoolFilter===key&&styles.schoolFilterActive]}><Text style={[styles.schoolFilterText,schoolFilter===key&&styles.schoolFilterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Peptide profiles</Text><Text style={styles.sectionLink}>{schoolResults.length} shown</Text></View>
          {schoolResults.map(c => (
            <View key={c.id} style={styles.schoolRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={c.name + " 101"} onPress={() => openSchool(c)} style={styles.schoolOpen}>
                <Molecule color={c.accent} /><View style={{ flex: 1 }}><Text style={styles.planOptionTitle}>{c.name}</Text><Text style={styles.detailMeta}>101 · Fundamentals & context</Text><Text style={styles.smallBadge}>{c.supplied?.evidenceBadge}</Text></View><Text style={styles.linkArrow}>›</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={(schoolFavorites.includes(c.id)?"Remove ":"Add ") + c.name + (schoolFavorites.includes(c.id)?" from favorites":" to favorites")} onPress={()=>toggleSchoolFavorite(c.id)} style={styles.favoriteButton}><Text style={[styles.favoriteIcon,schoolFavorites.includes(c.id)&&styles.favoriteIconActive]}>{schoolFavorites.includes(c.id)?"★":"☆"}</Text></Pressable>
            </View>
          ))}
          {!schoolResults.length && <Text style={styles.emptyText}>{schoolFilter==="favorites"?"Star a School profile to keep it here.":"No matches. Try another name, alias or filter."}</Text>}
        </>}

        {schoolSection==="courses"&&<>
          <View style={styles.schoolSectionIntro}><Text style={styles.kicker}>GUIDED LEARNING</Text><Text style={styles.sectionTitle}>Courses</Text><Text style={styles.helper}>Follow a short path when you want more structure. Only the course you open expands.</Text></View>
          <QuickStart/>
          <LearningPaths/>
        </>}

        {schoolSection==="facts"&&<>
          <View style={styles.schoolSectionIntro}><Text style={styles.kicker}>QUICK FACTS</Text><Text style={styles.sectionTitle}>Answers without the course</Text><Text style={styles.helper}>Search practical app concepts, terminology and research-literacy fundamentals.</Text></View>
          <SchoolBasics/>
        </>}

        {schoolSection==="community"&&
          <View style={styles.communityCard}>
            <View style={styles.communityIcon}><Text style={styles.communityIconText}>◎</Text></View>
            <Text style={styles.kicker}>COMMUNITY · COMING LATER</Text>
            <Text style={styles.sectionTitle}>Learn with context—not noise.</Text>
            <Text style={styles.nextText}>This area is reserved for moderated questions, expert-reviewed discussions and useful shared learning. It will remain separate from your private plans and tracking.</Text>
            <AppButton label="Give private beta feedback" onPress={()=>{setFeedbackOrigin('Community');setFeedbackMessage('');setScreen('betaFeedback');}}/>
          </View>}
      </ScrollView>
  );

  const referenceContext = (plan: PlanTemplate['suppliedPlan']) => <>
    {plan.notes && <Text style={styles.nextText}>{plan.notes}</Text>}
    {plan.continuationRule && <Text style={styles.nextText}>{plan.continuationRule}</Text>}
    {plan.maintenance && <Text style={styles.nextText}>{plan.maintenance}</Text>}
    {plan.tolerabilityRule && <Text style={styles.nextText}>{plan.tolerabilityRule}</Text>}
    {plan.maximumMgWeekly !== undefined && <Text style={styles.nextText}>Supplied maximum: {plan.maximumMgWeekly} mg weekly</Text>}
  </>;
  const renderReference = (template: PlanTemplate, deep: boolean) => <View key={template.id} style={styles.lessonCard}>
    <Text style={styles.sourceClass}>{template.sourceClass}</Text>
    <Text style={styles.lessonTitle}>{template.title}</Text>
    <Text style={styles.helper}>{template.suppliedPlan.frequency} · {template.stages.length} reference stages</Text>
    <View style={styles.referenceStages}>{template.originalStages.map((stage, i) => <View key={i} style={styles.referenceStage}>
      <Text style={styles.referenceAmount}>{stage.amountMg} mg</Text><Text style={styles.smallBadge}>{stage.durationWeeks} weeks</Text>
    </View>)}</View>
    {(template.suppliedPlan.continuationRule || template.suppliedPlan.maintenance) && <Text style={styles.helper}>Continuation is described separately; only the supplied stages are copied.</Text>}
    {deep && referenceContext(template.suppliedPlan)}
    {deep && <Text selectable style={styles.helper}>Source IDs: {template.sourceIds.join(' · ')}</Text>}
    <SetupPreview compoundId={selected.id} amountMg={String(template.originalStages[0]?.amountMg??'')}/><AppButton label="Use this reference setup in Guide →" onPress={() => copySchoolPlan(template)} secondary />
  </View>;
  const renderSchoolDetail = (deep = false) => {
    const record = selected.supplied!;
    const plans = selected.school.referenceSchedules;
    return <ScrollView contentContainerStyle={styles.scrollContent}>
      <Pressable accessibilityRole="button" onPress={() => setScreen(deep ? "schoolDetail" : "school")}><Text style={styles.back}>‹ {deep ? selected.name + " 101" : "Pep School"}</Text></Pressable>
      <Text style={styles.kicker}>{deep ? "LEARN MORE" : "COMPOUND 101"}</Text>
      <Text style={styles.detailTitle}>{selected.name}</Text>
      <Text style={styles.detailMeta}>{deep ? "Research, context & references" : "A simple introduction, one idea at a time."}</Text>
      {!deep && <>
        {[["What is it?", record.school101.whatIsIt], ["In Plain English", record.school101.plainEnglish], ["Studied / known for", record.school101.studiedFor]].map(([heading, text]) => <View key={heading} style={styles.lessonCard}><Text style={styles.lessonTitle}>{heading}</Text><Text style={styles.nextText}>{text}</Text></View>)}
      </>}

      <SchoolHighlights compound={selected}/>
      <View testID="evidence-badge"><Evidence kind={record.evidenceBadge} text={record.evidenceBadge}/></View>
      <SchoolAccordion key={selected.id} sections={schoolSections(selected)}/>
      {deep && <>
        {record.composition && <View style={styles.lessonCard}><Text style={styles.lessonTitle}>Exact blend composition</Text>{record.composition.map(component => <Text key={component.component} style={styles.nextText}>{component.component} · {component.amountMg} mg</Text>)}<Text style={styles.lessonTitle}>Total: {record.composition.reduce((sum, item) => sum + item.amountMg, 0)} mg</Text></View>}
      </>}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Reference Plans</Text></View>
      {plans.length ? plans.map(plan => renderReference(plan, deep)) : <View style={styles.lessonCard}><Text style={styles.nextText}>{selected.id==='ss-31'?'SS-31 content / research gap: no approved transferable reference plan is supplied.':'No transferable reference plan is supplied in this library.'}</Text><Text style={styles.sourceClass}>{RESEARCH_PRACTICE_LABEL}</Text><Text style={styles.helper}>{researchPracticeFor(selected).transferable?'Reference available for review.':'Awaiting reviewed defaults. No new values have been supplied.'}</Text><Text style={styles.helper}>You can create a Custom Plan in Guide. No schedule or setup values will be filled in without a reference.</Text></View>}
      {selected.researchPracticeReference&&<ResearchPracticeCard reference={selected.researchPracticeReference} onModel={()=>copySchoolPlan()}/>}{record.commonResearchPractice && <View style={styles.lessonCard}>
        <Evidence kind={record.commonResearchPractice.sourceClass}/>
        <View style={{flexDirection:"row",alignItems:"center"}}><Text style={[styles.lessonTitle,{flex:1}]}>{record.commonResearchPractice.title}</Text><ProfessorHelp title="About this reference plan" body="This shows a staged research-reference plan, including the stage amounts, duration, schedule, vial and calculation setup used in the cited source." note="Tap Use This Plan to copy these details into Build Plan. You can review and change every field before starting it. This is educational reference information, not a personalized recommendation."/></View>
        {(record.commonResearchPractice.stages||[]).map((stage:any,i:number)=><Text key={i} style={styles.nextText}>Stage {i+1} · {stage.amountMcg!=null?stage.amountMcg+' mcg':stage.amountMg+' mg'} · {stage.durationWeeks} weeks</Text>)}
        <Text style={styles.nextText}>{record.commonResearchPractice.frequency?.type==='daily'?'Daily':'Mon–Fri'} · 9:00 AM</Text>
        <Text style={styles.nextText}>{record.commonResearchPractice.vialStrengthMg} mg vial · {record.commonResearchPractice.diluentMl} mL diluent</Text>
        {record.commonResearchPractice.plannedBreakWeeks!=null&&<Text style={styles.nextText}>Planned break · {record.commonResearchPractice.plannedBreakWeeks} weeks</Text>}
        {record.commonResearchPractice.referenceDraw&&<Text style={styles.nextText}>Reference draw · {record.commonResearchPractice.referenceDraw.u100Units} U / {record.commonResearchPractice.referenceDraw.volumeMl} mL</Text>}
        {record.commonResearchPractice.formulationLocked&&<Text style={styles.nextText}>{record.commonResearchPractice.formulationLocked}</Text>}
        <SetupPreview compoundId={selected.id} amountMg={String(record.commonResearchPractice.stages?.[0]?.amountMg??(record.commonResearchPractice.stages?.[0]?.amountMcg!=null?record.commonResearchPractice.stages[0].amountMcg/1000:''))}/>{record.commonResearchPractice.guideTransfer&&<AppButton label="Use This Plan →" onPress={()=>copySchoolPlan()} secondary/>}
      </View>}
      <View style={styles.lessonCard}><Text style={styles.lessonTitle}>Important Considerations</Text>{(deep ? record.keyConsiderations : record.keyConsiderations.slice(0, 1)).map(text => <Text key={text} style={styles.consideration}>{text}</Text>)}{!deep && record.keyConsiderations.length > 1 && <Text style={styles.helper}>More considerations in Learn More.</Text>}</View>
      {!deep && <AppButton label="Learn More" onPress={() => setScreen("schoolMore")} secondary />}
      <AppButton label="Sources" onPress={() => setScreen("schoolSources")} secondary />
      <RelatedSchoolCards items={relatedSchool(selected,compounds)} onOpen={id=>{const next=compounds.find(c=>c.id===id);if(next)openSchool(next);}}/>
      <ResearchProductLink label={"AURAPEP research product: "+selected.name}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Open blank plan builder in Guide" onPress={() => openCompound(selected)} style={styles.crossLink}><Text style={styles.crossLinkText}>Build a plan from scratch in Guide →</Text></Pressable>
    </ScrollView>;
  };
  const renderSources = () => <ScrollView contentContainerStyle={styles.scrollContent}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Learn More" onPress={() => setScreen("schoolMore")}><Text style={styles.back}>‹ Learn More</Text></Pressable>
    <Text style={styles.kicker}>SOURCES</Text><Text style={styles.detailTitle}>{selected.name}</Text><Text style={styles.detailMeta}>Sources & references</Text>
    {(selected.supplied!.commonResearchPractice?.sourceUrls||[]).map((url:string,i:number)=><View key={url} style={styles.lessonCard}><Text style={styles.sourceClass}>COMMON RESEARCH PRACTICE</Text><Text selectable style={styles.nextText}>{url}</Text></View>)}
    {selected.supplied!.sources.length===0&&<Text style={styles.helper}>This library entry provides research context only. Study citations and a transferable reference plan have not been supplied.</Text>}
    {selected.supplied!.sources.map(source => <View key={source.id} testID={"source-" + source.id} style={styles.lessonCard}><Text selectable style={styles.sourceClass}>{source.id}</Text><Text style={styles.lessonTitle}>{source.title}</Text><Text style={styles.helper}>{source.type}</Text>{source.url&&<Pressable accessibilityRole="link" accessibilityLabel={"Read "+source.title} onPress={()=>Linking.openURL(source.url!)}><Text style={styles.back}>Read source ↗</Text></Pressable>}</View>)}
  </ScrollView>;
  const renderDataImport=()=>(
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Pressable accessibilityRole="button" onPress={()=>setScreen('settings')}><Text style={styles.back}>‹ My data & privacy</Text></Pressable>
      <Text style={styles.kicker}>IMPORT DATA</Text><Text style={styles.detailTitle}>Bring your history with you</Text>
      <Text style={styles.detailMeta}>Preview a supported CSV before anything is added. Importing never silently replaces existing EZPep Planner data.</Text>
      {!!importResult&&!importPreview&&<View style={[styles.lessonCard,{borderColor:'#2f9e62',borderWidth:2,backgroundColor:'#f1fbf5'}]}><Text style={[styles.sourceClass,{color:'#178066'}]}>IMPORT COMPLETE</Text><Text style={styles.lessonTitle}>{importResult}</Text><AppButton label="View imported peptides" onPress={()=>setScreen('plans')}/><AppButton label="Import another CSV" secondary onPress={()=>setImportResult('')}/></View>}
      <Modal visible={!!importSummary} transparent animationType="fade" onRequestClose={()=>setImportSummary('')}><View style={styles.importModalShade}><View style={styles.importModalCard}><Text style={[styles.sourceClass,{color:'#178066'}]}>IMPORT COMPLETE</Text><Text style={styles.importModalTitle}>{importSummary.split(' · ')[0]}</Text><Text style={styles.nextText}>{importSummary.split(' · ').slice(1).join(' · ')}</Text><AppButton label="View My Peptides" onPress={()=>{setImportSummary('');setScreen('plans');}}/><AppButton label="Stay here" secondary onPress={()=>setImportSummary('')}/></View></View></Modal>
      <View style={styles.lessonCard}><Text style={styles.sourceClass}>SUPPORTED NOW</Text><Text style={styles.lessonTitle}>Peptide Library CSV export</Text><Text style={styles.nextText}>Choose the exported CSV on the web build, or paste its contents below. The preview checks peptide names, schedules, inventory, units and possible duplicate history.</Text><AppButton label="Choose CSV file" onPress={chooseImportFile}/></View>
      <View style={styles.lessonCard}><Text style={styles.lessonTitle}>Paste CSV for preview</Text><TextInput accessibilityLabel="CSV data" multiline value={importText} onChangeText={setImportText} placeholder="Paste CSV contents here…" style={[styles.smallInput,{minHeight:150,textAlignVertical:'top'}]}/><AppButton label="Preview imported data" secondary onPress={()=>previewImport(importText)}/>{!!importError&&<Text accessibilityLiveRegion="polite" style={[styles.helper,{color:'#b2384a',marginTop:10}]}>{importError}</Text>}</View>
      {importPreview&&<View style={styles.lessonCard}><Text style={styles.sourceClass}>IMPORT PREVIEW</Text><Text style={styles.lessonTitle}>{importPreview.peptides.length} peptides found</Text>
        <View style={styles.summaryRow}><View style={styles.summaryBox}><Text style={styles.summaryBig}>{importPreview.historyCount}</Text><Text style={styles.summarySmall}>History entries</Text></View><View style={styles.summaryBox}><Text style={styles.summaryBig}>{importPreview.inventoryCount}</Text><Text style={styles.summarySmall}>Inventory records</Text></View><View style={styles.summaryBox}><Text style={styles.summaryBig}>{importPreview.scheduleCount}</Text><Text style={styles.summarySmall}>Schedules</Text></View></View>
        <Text style={[styles.nextText,{marginTop:14}]}>{importPreview.peptides.join(' · ')}</Text>
        {!!importPreview.duplicateKeys.length&&<Text style={styles.smallBadge}>{importPreview.duplicateKeys.length} duplicate history {importPreview.duplicateKeys.length===1?'entry':'entries'} found in this file. Duplicates will not be added twice.</Text>}
        {importPreview.warnings.map((warning,index)=><Text key={index} style={[styles.helper,{color:'#b2384a',marginTop:10}]}>• {warning}</Text>)}
        <Text style={styles.smallBadge}>Preview only—nothing has been saved yet. Complete each selected peptide card below, then import every card that is ready.</Text>
      </View>}
      {importPreview&&importSetups.map(setup=>{const errors=externalSetupErrors(setup),bad=(phrase:string)=>errors.some(error=>error.toLowerCase().includes(phrase));return <View key={setup.key} style={[styles.lessonCard,!setup.selected&&{opacity:.55},setup.selected&&!errors.length&&{borderColor:'#2f9e62',borderWidth:2,backgroundColor:'#f1fbf5'}]}>
        <View style={{flexDirection:'row',justifyContent:'space-between',gap:10}}><View style={{flex:1}}><Text style={styles.sourceClass}>{!setup.selected?'SKIPPED':errors.length?'NEEDS '+errors.length+' '+(errors.length===1?'ANSWER':'ANSWERS'):setup.archived?'READY TO ARCHIVE':'READY TO IMPORT'}</Text><Text style={styles.lessonTitle}>{setup.peptideName}</Text><Text style={styles.helper}>{setup.historyCount} history entries · {setup.inventoryCurrentMg||'No'} mg remaining</Text></View><Pressable accessibilityRole="checkbox" accessibilityState={{checked:setup.selected}} onPress={()=>changeImportSetup(setup.key,{selected:!setup.selected})} style={[styles.goalCard,{flex:0,minWidth:108},setup.selected&&!errors.length&&{backgroundColor:'#2f9e62',borderColor:'#2f9e62'},setup.selected&&errors.length>0&&{backgroundColor:'#fff5db',borderColor:'#d99b24'}]}><Text style={[styles.goalText,setup.selected&&!errors.length&&{color:'#fff'}]}>{!setup.selected?'○ Skip':errors.length?'◉ Import':'✓ Will import'}</Text></Pressable></View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:setup.archived}} onPress={()=>changeImportSetup(setup.key,{archived:!setup.archived,indefinite:setup.archived?setup.indefinite:false})} style={[styles.goalCard,{marginTop:12},setup.archived&&styles.choiceCardSelected]}><Text style={styles.goalText}>{setup.archived?'✓ Import as archived history':'Archive instead of active tracking'}</Text><Text style={styles.helper}>{setup.archived?'No future schedule will be created.':'Keep this peptide active after import.'}</Text></Pressable>
        {!setup.archived&&<><Text style={styles.inputLabel}>Current dose</Text><View style={[styles.inputUnitRow,bad('current dose')&&{borderColor:'#c93f55',borderWidth:2}]}><TextInput accessibilityLabel={setup.peptideName+' current dose'} keyboardType="decimal-pad" value={setup.doseUnit==='mcg'&&setup.doseMg?String(Number(setup.doseMg)*1000):setup.doseMg} onChangeText={value=>changeImportSetup(setup.key,{doseMg:setup.doseUnit==='mcg'&&value?String(Number(value)/1000):value})} style={styles.largeInput}/><Text style={styles.unit}>{setup.doseUnit}</Text></View>
        <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Text style={styles.inputLabel}>Vial strength</Text><View style={[styles.inputUnitRow,bad('vial strength')&&{borderColor:'#c93f55',borderWidth:2}]}><TextInput accessibilityLabel={setup.peptideName+' vial strength'} keyboardType="decimal-pad" value={setup.vialMg} onChangeText={vialMg=>changeImportSetup(setup.key,{vialMg})} style={styles.largeInput}/><Text style={styles.unit}>mg</Text></View></View><View style={{flex:1}}><Text style={styles.inputLabel}>Diluent volume</Text><View style={[styles.inputUnitRow,bad('diluent')&&{borderColor:'#c93f55',borderWidth:2}]}><TextInput accessibilityLabel={setup.peptideName+' diluent volume'} keyboardType="decimal-pad" value={setup.waterMl} onChangeText={waterMl=>changeImportSetup(setup.key,{waterMl})} style={styles.largeInput}/><Text style={styles.unit}>mL</Text></View><Text style={[styles.helper,{fontSize:11,marginTop:3}]}>(bac water)</Text></View></View></>}
        {!setup.archived&&<><Text style={styles.inputLabel}>Continue tracking for</Text><View style={[styles.inputUnitRow,bad('future tracking')&&{borderColor:'#c93f55',borderWidth:2},setup.indefinite&&{opacity:.45}]}><TextInput accessibilityLabel={setup.peptideName+' future tracking weeks'} editable={!setup.indefinite} keyboardType="number-pad" value={setup.indefinite?'':setup.futureWeeks} onChangeText={futureWeeks=>changeImportSetup(setup.key,{futureWeeks})} placeholder={setup.indefinite?'No end date':''} style={styles.largeInput}/><Text style={styles.unit}>weeks</Text></View><Pressable accessibilityRole="checkbox" accessibilityState={{checked:setup.indefinite}} onPress={()=>changeImportSetup(setup.key,{indefinite:!setup.indefinite})} style={[styles.goalCard,{marginTop:8},setup.indefinite&&styles.choiceCardSelected]}><Text style={styles.goalText}>{setup.indefinite?'✓ Indefinite — no planned end date':'Indefinite — no planned end date'}</Text></Pressable></>}
        <Text style={styles.inputLabel}>Start date</Text><TextInput accessibilityLabel={setup.peptideName+' start date'} value={setup.startDate} onChangeText={startDate=>changeImportSetup(setup.key,{startDate})} placeholder="YYYY-MM-DD" style={[styles.smallInput,bad('start date')&&{borderColor:'#c93f55',borderWidth:2}]}/>
        {!setup.archived&&<><Text style={[styles.inputLabel,{marginTop:12}]}>Schedule days</Text>{setup.scheduleKind==='daily'?<Text style={styles.nextText}>Daily · {setup.scheduleTimes.join(' / ')}</Text>:<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,index)=>{const selected=setup.scheduleDays.includes(index);return <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{checked:selected}} onPress={()=>changeImportSetup(setup.key,{scheduleDays:selected?setup.scheduleDays.filter(value=>value!==index):[...setup.scheduleDays,index].sort()})} style={[styles.goalCard,{flex:0,minWidth:63,borderColor:bad('weekday')?'#c93f55':undefined},selected&&styles.choiceCardSelected]}><Text style={styles.goalText}>{selected?'✓ ':''}{day}</Text></Pressable>;})}</View>}<Text style={styles.nextText}>Time: {setup.scheduleTimes.join(' / ')||'No valid time found'} · Remaining inventory: {setup.inventoryCurrentMg||'not supplied'} mg</Text></>}
        {setup.archived&&<Text style={styles.nextText}>{setup.historyCount} recorded history entries will be preserved. No future schedule or syringe-unit calculation will be created unless the source data included concentration.</Text>}
        {errors.map(error=><Text key={error} style={[styles.helper,{color:'#b2384a',marginTop:6}]}>• {error}</Text>)}
      </View>})}
      {importPreview&&<View style={styles.lessonCard}><Text style={styles.lessonTitle}>{importSetups.filter(item=>item.selected&&!externalSetupErrors(item).length).length} ready to import</Text><Text style={styles.nextText}>Ready active cards receive future schedules, history and remaining inventory. Archived cards keep their history without appearing as active tracking. A private pre-import backup is saved first.</Text><AppButton label={importing?"Importing…":"Import all ready peptides"} disabled={importing} onPress={confirmReadyImports}/>{!!importResult&&<Text accessibilityLiveRegion="polite" style={styles.smallBadge}>{importResult}</Text>}{!!importError&&<Text accessibilityLiveRegion="assertive" style={[styles.helper,{color:'#b2384a',marginTop:10}]}>Import error: {importError}</Text>}{importResult.startsWith('Import complete')&&<AppButton label="View imported peptides" secondary onPress={()=>setScreen('plans')}/>} </View>}
      <AppButton label="Back to My data & privacy" secondary onPress={()=>setScreen('settings')}/>
    </ScrollView>
  );
  const openBetaFeedback=(origin:string)=>{setFeedbackOrigin(origin);setFeedbackMessage('');setScreen('betaFeedback');};
  const exportBetaFeedback=async()=>{
    if(!feedbackText.trim()){setFeedbackMessage('Describe what happened or what you would change.');return;}
    const report=['EZPep Planner private beta feedback','Type: '+feedbackType,'Opened from: '+feedbackOrigin,'App version: 0.4','Platform: '+Platform.OS,'Viewport: '+Math.round(viewportWidth)+' px','Created: '+new Date().toISOString(),feedbackIncludePlans?'Active peptide names: '+(plans.map(plan=>plan.compoundName).join(', ')||'None'):'Active peptide names: Not included by tester','',feedbackText.trim()].join('\n');
    try{
      if(Platform.OS==='web'){
        const web=globalThis as any,url=web.URL.createObjectURL(new web.Blob([report],{type:'text/plain'})),link=web.document.createElement('a');link.href=url;link.download='ezpep-beta-feedback-'+new Date().toISOString().slice(0,10)+'.txt';link.click();web.URL.revokeObjectURL(url);
        setFeedbackMessage('Private feedback file downloaded. Send it to the beta coordinator. You can also submit from an eligible beta account after saving account consent.');
      }else{
        await Share.share({title:'EZPep Planner beta feedback',message:report});setFeedbackMessage('Feedback report opened in your device share sheet.');
      }
    }catch{setFeedbackMessage('The report was not exported. Your text remains here so you can try again.');}
  };
  const sendCloudFeedback=async()=>{
    if(feedbackSubmitting)return;
    setFeedbackSubmitting(true);
    try{
      await submitBetaFeedback({category:feedbackType,message:feedbackText,origin:feedbackOrigin,platform:Platform.OS,browser:'Other',includePlanDetails:feedbackIncludePlans,activePeptideNames:feedbackIncludePlans?plans.map(plan=>plan.compoundName):undefined});
      setFeedbackMessage('Feedback submitted privately. Your planner data was not uploaded.');
      if(analyticsConsent===true)void trackBetaAnalytics('feedback_submitted');
    }catch(error){setFeedbackMessage(error instanceof Error?error.message:'Feedback was not submitted. Your report remains here.');}
    finally{setFeedbackSubmitting(false);}
  };
  const saveBetaConsent=async()=>{if(!betaConsentChecked)return;const at=new Date().toISOString();try{await AsyncStorage.setItem('pepplan.beta-consent.v1',at);setBetaConsentAt(at);}catch{Alert.alert('Consent was not saved','Nothing else was changed. Keep the app open and try again.');}};
  const renderBetaPrivacy=()=> <ScrollView contentContainerStyle={styles.scrollContent}>
    <Pressable accessibilityRole="button" onPress={()=>setScreen('more')}><Text style={styles.back}>‹ More</Text></Pressable><Text style={styles.kicker}>PRIVATE WEB BETA</Text><Text style={styles.detailTitle}>Privacy and participation</Text><Text style={styles.detailMeta}>Review this draft before joining the invite-only beta.</Text>
    <View style={styles.lessonCard}><Text style={styles.lessonTitle}>What this beta is</Text><Text style={styles.nextText}>EZPep Planner is an educational research, planning and tracking tool. It does not diagnose, prescribe, select a peptide or replace professional medical advice. Beta features may change and may contain errors.</Text></View>
    <View style={styles.lessonCard}><Text style={styles.lessonTitle}>Your information</Text><Text style={styles.nextText}>The current build keeps plans, schedules, calculations, history and inventory on this device. When cloud accounts are enabled, transfer will require a preview and explicit confirmation. The local copy will remain recoverable during migration.</Text><Text style={styles.nextText}>Routine authentication and reminder emails will not include peptide names, amounts, schedules or history. Feedback excludes plan information unless you explicitly choose to include it. EZPep also records limited product usage and time spent by app area for service operation and improvement; it does not include planner content.</Text></View>
    <View style={styles.lessonCard}><Text style={styles.lessonTitle}>Your controls</Text><Text style={styles.nextText}>You will be able to export your account data, sign out, manage sessions and request account deletion. Until cloud accounts are connected, use Preferences & Data to export or restore the local record.</Text></View>
    {betaConsentAt?<View style={styles.notice}><Text style={styles.noticeText}>Acknowledged on this device: {new Date(betaConsentAt).toLocaleString()}. Account-linked consent will be requested again when secure beta accounts are enabled.</Text></View>:<View style={styles.lessonCard}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:betaConsentChecked}} onPress={()=>setBetaConsentChecked(value=>!value)} style={styles.notice}><Text style={styles.noticeText}>{betaConsentChecked?'✓':'○'} I understand this is an unfinished educational beta, not medical advice, and that the current data is stored on this device.</Text></Pressable><AppButton label="Save beta acknowledgement on this device" disabled={!betaConsentChecked} onPress={()=>{void saveBetaConsent();}}/></View>}

    <AppButton label="Back to More" secondary onPress={()=>setScreen('more')}/>
  </ScrollView>;

  const renderBetaFeedback=()=> <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={()=>setScreen(feedbackOrigin==='Community'?'school':'more')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.kicker}>PRIVATE BETA FEEDBACK</Text><Text style={styles.detailTitle}>Help improve EZPep Planner</Text><Text style={styles.detailMeta}>Report a problem, confusing step, suggestion or calculation concern.</Text>
    <View style={styles.notice}><Text style={styles.noticeText}>Your plans and history are not included automatically. You can download a private report, or submit it from an eligible beta account after saving account consent. Avoid including sensitive information in your message.</Text></View>
    <View style={styles.lessonCard}><Text style={styles.lessonTitle}>What kind of feedback is this?</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['Bug','Confusing','Suggestion','Calculation concern'] as const).map(type=><Pressable key={type} accessibilityRole="radio" accessibilityState={{checked:feedbackType===type}} onPress={()=>setFeedbackType(type)} style={[styles.schoolFilter,feedbackType===type&&styles.schoolFilterActive]}><Text style={[styles.schoolFilterText,feedbackType===type&&styles.schoolFilterTextActive]}>{type}</Text></Pressable>)}</View><Text style={[styles.inputLabel,{marginTop:16}]}>What happened or what would help?</Text><TextInput accessibilityLabel="Beta feedback details" multiline value={feedbackText} onChangeText={value=>{setFeedbackText(value);setFeedbackMessage('');}} placeholder="Describe the screen, action and result…" style={[styles.smallInput,{minHeight:140,textAlignVertical:'top'}]}/><Pressable accessibilityRole="checkbox" accessibilityState={{checked:feedbackIncludePlans}} onPress={()=>setFeedbackIncludePlans(value=>!value)} style={styles.notice}><Text style={styles.noticeText}>{feedbackIncludePlans?'✓':'○'} Include active peptide names in this report</Text></Pressable>{!!feedbackMessage&&<Text accessibilityLiveRegion="polite" style={styles.helper}>{feedbackMessage}</Text>}<AppButton label={Platform.OS==='web'?'Download private feedback report':'Share private feedback report'} onPress={()=>{void exportBetaFeedback();}}/>{betaAccount.state.status==='eligible'&&<><AppButton label="Submit private beta feedback" disabled={feedbackSubmitting} onPress={()=>{void sendCloudFeedback();}}/><AppButton label="Review account consent" secondary onPress={()=>setScreen('profile')}/></>}<AppButton label="Clear feedback form" secondary onPress={()=>{setFeedbackText('');setFeedbackIncludePlans(false);setFeedbackMessage('Form cleared.');}}/></View>
  </ScrollView>;

  const renderMore = () => {
    const rows:{label:string;detail:string;target:Screen|null}[]=[
      {label:"Beta Feedback",detail:"Report a bug, confusion or suggestion privately",target:"betaFeedback"},
      {label:"Beta privacy & consent",detail:"Review beta data handling and research-use boundaries",target:"betaPrivacy"},
      {label:"Account",detail:"Local planner · private beta account",target:"profile"},
      {label:"Notifications",detail:"Plan reminders, timing and permission status",target:"reminders"},
      {label:"Inventory",detail:"Individual vials across active peptides",target:"inventory"},
      {label:"History",detail:"Completed and skipped events",target:"history"},
      {label:"Preferences",detail:"Units, appearance and planner defaults",target:"settings"},
      {label:"My data & privacy",detail:"Local storage, import, export and recovery",target:"settings"},
      {label:"Help & About",detail:"EZPep Planner 0.4, guidance and disclaimers",target:"settings"},
      {label:"Shop",detail:"Future AURAPEP connection · not connected",target:null},
    ];
    if(betaAdmin)rows.splice(2,0,{label:"Beta Dashboard",detail:"Owner-only tester access and aggregate usage",target:"betaDashboard"});
    return <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.kicker, { marginTop: 20 }]}>MORE</Text><Text style={styles.detailTitle}>Your EZPep Planner</Text><Text style={styles.detailMeta}>Account, reminders, preferences and support.</Text>
      <View style={styles.lessonCard}><Text style={styles.sourceClass}>CLOUD BACKUP & DEVICES</Text><Text style={styles.lessonTitle}>Quiet daily protection.</Text><Text style={styles.nextText}>EZPep saves changes on this device immediately and checks the private cloud once each evening. If the app was closed, it catches up the next time you open it. Use the controls here only when moving to another device or reviewing a sync issue.</Text><AppButton label="Cloud backup and device transfer" onPress={()=>setCloudGuideOpen(true)}/><AppButton label="View account" secondary onPress={()=>setScreen("profile")}/></View>
      {rows.map(row=><Pressable accessibilityRole="button" accessibilityLabel={row.label} disabled={!row.target} key={row.label} style={styles.moreRow} onPress={()=>row.target&&(row.target==='betaFeedback'?openBetaFeedback('More'):setScreen(row.target))}><View style={{flex:1}}><Text style={styles.planOptionTitle}>{row.label}</Text><Text style={styles.smallBadge}>{row.detail}</Text></View><Text style={styles.linkArrow}>{row.target?'›':'·'}</Text></Pressable>)}
      <View style={styles.notice}><Text style={styles.noticeText}>Prototype 0.4 · plans save on this device first. Signed-in accounts receive one quiet cloud backup check per day, normally around 8:00 PM local time or after the next app opening if that check was missed.</Text></View>
    </ScrollView>;
  };

  const renderGuide = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroBubbleOne} />
        <View style={styles.heroBubbleTwo} />
        <Text style={styles.kicker}>BUILD PLAN</Text>
        <Text style={styles.heroTitle}>Peptide Research{"\n"}Made Simple</Text>
        <Text style={styles.heroSub}>Understand. Plan. Calculate. Track.</Text>
        <View style={styles.professorWelcomeCard}>
          <Image accessibilityLabel="Professor Lynch" source={require("./assets/professor-lynch-checklist.webp")} resizeMode="contain" style={styles.professorWelcomeAvatar}/>
          <View style={styles.professorWelcomeBubble}><View style={styles.professorBubbleTail}/><Text style={styles.professorName}>A QUICK WORD FROM PROFESSOR LYNCH</Text><Text style={styles.professorMessage}>Choose a peptide to review its research context, then build a plan from the information you enter. I’ll help explain each step without choosing amounts or schedules for you.</Text></View>
        </View>

        <View style={styles.featureRow}>
          {[
            ["▤", "Clear", "Guide"],
            ["▥", "Plan", "Visually"],
            ["◎", "Track", "Progress"],
          ].map(([icon, a, b]) => (
            <View style={styles.featureItem} key={a}>
              <View style={styles.featureIcon}><Text style={styles.featureIconText}>{icon}</Text></View>
              <Text style={styles.featureText}>{a}{"\n"}{b}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search Guide"
          placeholder="Name, alias or abbreviation"
          placeholderTextColor="#91A0BC"
          style={styles.searchInput}
        />
        <Text style={styles.filterIcon}>☷</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Explore compounds</Text>
        <Text style={styles.sectionLink}>View All ›</Text>
      </View>

      <View style={styles.grid}>
        {filtered.map((c) => (
          <Pressable accessibilityRole="button" accessibilityLabel={c.name + " Guide"} key={c.name} onPress={() => openCompound(c)} style={({ pressed }) => [styles.compoundCard, pressed && { opacity: 0.85 }]}>
            <Molecule color={c.accent} />
            <Text style={styles.compoundName}>{c.id === "glow-70" ? "Glow\n(70 mg blend)" : c.name}</Text>
            <Text style={styles.compoundSub}>{c.subtitle}</Text>
            <View style={styles.tagRow}>
              {c.tags.slice(0, 2).map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </Pressable>
        ))}
      </View>

      {!filtered.length && <Text style={styles.emptyText}>No matches. Try another name or alias.</Text>}
      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>⚗</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Research. Plan. Track.</Text>
          <Text style={styles.bannerSub}>A clearer way to explore your peptide plan.</Text>
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </View>
    </ScrollView>
  );

  const renderDetail = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setScreen("guide")}><Text style={styles.back}>‹ Guide</Text></Pressable>
      <Text style={styles.detailTitle}>{selected.name}</Text>
      <Text style={styles.detailMeta}>Reference guide · plan templates · simple next steps</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Learn in Pep School" onPress={() => openSchool(selected)}><Text style={styles.back}>Learn in Pep School →</Text></Pressable>

      <View style={styles.detailHero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailHeroTitle}>Build your first plan</Text>
          <Text style={styles.detailHeroBody}>
            Choose how you want your plan to begin. Most people should start with a Basic Plan. You can change it later.
          </Text>
        </View>
        <Molecule color={selected.accent} />
      </View>

      {saved.store.draft?.compoundId === selected.id && (
        <>
          <Text style={styles.sectionTitle}>Continue where you left off</Text>
          <AppButton label="Continue My Plan" onPress={() => setScreen("plan")} />
        </>
      )}

      <Text style={styles.sectionTitle}>Choose a starting point</Text>

      {[
        ["Basic Plan", "Recommended", "One amount and one schedule. The simplest place to start.", "Start with one simple step using the amount and schedule you enter. You can add more steps later if your plan changes.", "steady"],
        ["Advanced Plan", "", "Use multiple steps when the amount or timing changes.", "Start with several editable steps. Each step can have its own amount, duration and schedule.", "staged"],
      ].map(([title, badge, sub, help, mode], idx) => (
        <Pressable accessibilityRole="button" accessibilityLabel={title} key={title} onPress={() => startPlan(mode as PlanMode)} style={styles.planOption}>
          <View style={[styles.planBars, { backgroundColor: idx === 0 ? COLORS.paleBlue : COLORS.palePurple }]}>
            <Text style={[styles.planBarsText, { color: idx === 0 ? COLORS.blue : COLORS.purple }]}>▥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection:"row",alignItems:"center",flexWrap:"wrap"}}>
              <Text style={styles.planOptionTitle}>{title}</Text>
              {!!badge && <Text style={styles.smallBadge}> · {badge}</Text>}
              <ProfessorHelp title={title} body={help} note="This choice only sets up the plan format. It does not choose an amount or recommend a plan."/>
            </View>
            <Text style={styles.planOptionSub}>{sub}</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </Pressable>
      ))}

      <Pressable accessibilityRole="button" accessibilityLabel="Browse research references in Learn" onPress={() => openSchool(selected)}>
        <Text style={styles.back}>Looking for a research reference? Browse Learn →</Text>
      </Pressable>
    </ScrollView>
  );

  if(!saved.ready)return <SafeAreaProvider><SafeAreaView style={styles.safe}><Text style={styles.detailTitle}>Opening your saved plan…</Text></SafeAreaView></SafeAreaProvider>;
  if(saved.loadFailed)return <SafeAreaProvider><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.welcomeContent}>
    <View style={styles.welcomeBrand}><Image accessibilityLabel="EZPep Planner" source={{uri:EZPEP_LOCKUP_DATA_URI}} resizeMode="contain" style={styles.welcomeBrandImage}/></View>
    <Text style={styles.kicker}>LOCAL DATA RECOVERY</Text><Text style={styles.welcomeTitle}>Your saved planner data could not be opened.</Text>
    <Text style={styles.welcomeSub}>The app has paused editing so the unreadable data is not replaced. Restore a valid EZPep Planner backup to continue on this device.</Text>
    <View style={styles.notice}><Text style={styles.noticeText}>{saved.error}</Text></View>
    <AppButton label="Choose backup file" onPress={chooseBackupFile}/>
    <Text style={styles.smallBadge}>Your current browser data stays unchanged until a backup passes validation and you confirm the restore.</Text>
    {restoreCandidate&&<Modal transparent animationType="fade" onRequestClose={()=>{if(!restoringBackup)setRestoreCandidate(null);}}><View style={styles.importModalShade}><View style={styles.importModalCard}><Text style={styles.sourceClass}>{restoreStatus.startsWith('Backup restored successfully')?'RESTORE COMPLETE':'RESTORE PREVIEW'}</Text><Text style={styles.importModalTitle}>{restoreStatus.startsWith('Backup restored successfully')?'Backup restored':'Replace the unreadable planner data?'}</Text><Text style={styles.nextText}>{restoreCandidate.plans} active plans · {restoreCandidate.archives} archived plans · {restoreCandidate.history} saved history entries</Text><View style={styles.restoreDates}><Text style={styles.smallBadge}>File: {restoreCandidate.fileName}</Text><Text style={styles.smallBadge}>Backup file saved: {backupDateLabel(restoreCandidate.fileSavedAt)}</Text><Text style={styles.smallBadge}>Latest planner activity in backup: {backupDateLabel(restoreCandidate.plannerUpdatedAt)}</Text></View>{!!restoreStatus&&<Text accessibilityLiveRegion="polite" style={restoreStatus.startsWith('Backup was not')?styles.restoreError:styles.restoreGood}>{restoreStatus}</Text>}{restoreStatus.startsWith('Backup restored successfully')?<AppButton label="View restored planner" onPress={()=>{setRestoreCandidate(null);setRestoreStatus('');setScreen('plans');}}/>:<><Text style={styles.smallBadge}>The validated backup becomes active only after confirmation. A single local safety copy is retained without filling browser storage with duplicate backups.</Text><AppButton label={restoringBackup?'Restoring backup…':'Confirm restore backup'} disabled={restoringBackup} onPress={restoreLocalBackup}/><AppButton label="Cancel restore" disabled={restoringBackup} secondary onPress={()=>{setRestoreCandidate(null);setRestoreStatus('');}}/></>}</View></View></Modal>}
  </ScrollView></SafeAreaView></SafeAreaProvider>;
  if(betaAccount.state.status!=='eligible')return <SafeAreaProvider><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"><BetaAccountPanel account={betaAccount}/><AppButton label="Export local backup" secondary onPress={exportLocalBackup}/><Text style={styles.smallBadge}>Your local data is preserved while account access is checked. Backup recovery remains available if saved data cannot be opened.</Text></ScrollView></SafeAreaView></SafeAreaProvider>;
  return (
    <SafeAreaProvider><SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.topLine}>
        <View style={styles.brandLockup}><Image accessibilityLabel="EZPep Planner" source={{uri:EZPEP_LOCKUP_DATA_URI}} resizeMode="contain" style={styles.brandLockupImage}/></View>
        <View style={{flexDirection:"row",alignItems:"center",gap:4}}><Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={()=>setScreen("profile")} style={{width:36,minHeight:44,alignItems:"center",justifyContent:"center"}}><Svg width={20} height={22} viewBox="0 0 24 24"><Circle cx={12} cy={7} r={4} fill="none" stroke={COLORS.ink} strokeWidth={1.7}/><Path d="M 4 22 L 4 19 C 4 12 20 12 20 19 L 20 22 Z" fill="none" stroke={COLORS.ink} strokeWidth={1.7}/></Svg></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={()=>setScreen("settings")} style={{width:36,minHeight:44,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:20,color:COLORS.ink}}>⚙</Text></Pressable></View>
      </View>
      {(!!saved.error||!!reminderError)&&<View style={styles.saveSyncRow}>{!!saved.error&&<Text testID="save-status" style={styles.smallBadge}>{saved.error}</Text>}{!!saved.error&&!saved.loadFailed&&<AppButton label="Retry save" onPress={()=>saved.retry().catch(()=>{})} secondary/>}{!!reminderError&&<Text style={styles.smallBadge}>{reminderError}</Text>}</View>}
      {!!editError&&<Text style={styles.helper}>{editError}</Text>}
      {currentEdit&&<View style={{paddingHorizontal:20,paddingVertical:4,backgroundColor:COLORS.paleBlue}}><Text style={styles.smallBadge}>{editing?(saved.store.activeEdit?'Editing active plan · changes apply when saved':'Viewing plan settings · a draft is saved after your first change'):'You have saved active-plan edits.'}</Text><View style={{flexDirection:'row',gap:18}}>{!editing&&saved.store.activeEdit&&<Pressable accessibilityRole="button" accessibilityLabel="Resume plan edits" onPress={()=>editPlan(saved.store.activeEdit!.planId)}><Text style={styles.back}>Resume edits</Text></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel="Discard plan edits" onPress={()=>setDiscardEdits(true)}><Text style={styles.back}>{saved.store.activeEdit?'Discard edits':'Close editor'}</Text></Pressable></View></View>}
      {replacement&&<View style={{padding:16,backgroundColor:COLORS.paleBlue}}><Text style={styles.helper}>You have an unfinished {saved.store.draft?.compoundName} draft. Replace only that draft? Active plans and history will stay unchanged.</Text><AppButton label="Confirm replace draft" onPress={()=>{const next=replacement;saved.update(old=>({...old,draft:next.draft})).then(()=>{setReplacement(null);setScreen(next.target);}).catch(()=>{});}}/><AppButton label="Keep existing draft" secondary onPress={()=>setReplacement(null)}/></View>}
      {discardEdits&&<View style={{padding:16,backgroundColor:COLORS.paleBlue}}><Text style={styles.helper}>{saved.store.activeEdit?'Discard saved edits? Active plans and history will stay unchanged.':'Close the editor? You have not changed this plan.'}</Text><AppButton label={saved.store.activeEdit?'Confirm discard edits':'Close editor'} onPress={()=>discardActiveEdits().then(()=>setDiscardEdits(false))}/><AppButton label={saved.store.activeEdit?'Keep edits':'Keep editor open'} secondary onPress={()=>setDiscardEdits(false)}/></View>}
      {restoreCandidate&&<Modal transparent animationType="fade" onRequestClose={()=>{if(!restoringBackup)setRestoreCandidate(null);}}><View style={styles.importModalShade}><View style={styles.importModalCard}><Text style={styles.sourceClass}>{restoreStatus.startsWith('Backup restored successfully')?'RESTORE COMPLETE':'RESTORE PREVIEW'}</Text><Text style={styles.importModalTitle}>{restoreStatus.startsWith('Backup restored successfully')?'Backup restored':'Replace this device’s planner data?'}</Text><Text style={styles.nextText}>{restoreCandidate.plans} active plans · {restoreCandidate.archives} archived plans · {restoreCandidate.history} saved history entries</Text><View style={styles.restoreDates}><Text style={styles.smallBadge}>File: {restoreCandidate.fileName}</Text><Text style={styles.smallBadge}>Backup file saved: {backupDateLabel(restoreCandidate.fileSavedAt)}</Text><Text style={styles.smallBadge}>Latest planner activity in backup: {backupDateLabel(restoreCandidate.plannerUpdatedAt)}</Text><Text style={styles.smallBadge}>Latest planner activity on this device: {backupDateLabel(plannerChangedAt(saved.store))}</Text></View>{!!restoreStatus&&<Text accessibilityLiveRegion="polite" style={restoreStatus.startsWith('Backup was not')?styles.restoreError:styles.restoreGood}>{restoreStatus}</Text>}{restoreStatus.startsWith('Backup restored successfully')?<AppButton label="View restored planner" onPress={()=>{setRestoreCandidate(null);setRestoreStatus('');setScreen('plans');}}/>:<><Text style={styles.smallBadge}>{restoreCandidate.plannerUpdatedAt&&plannerChangedAt(saved.store)&&Date.parse(restoreCandidate.plannerUpdatedAt)>Date.parse(plannerChangedAt(saved.store)!)?'This backup contains the newer recorded planner activity.':'Review these dates carefully. If both copies changed, keep the one you recognize rather than relying only on a timestamp.'} A private pre-restore recovery copy is created first.</Text><AppButton label={restoringBackup?'Restoring backup…':'Confirm restore backup'} disabled={restoringBackup} onPress={restoreLocalBackup}/><AppButton label="Cancel restore" disabled={restoringBackup} secondary onPress={()=>{setRestoreCandidate(null);setRestoreStatus('');}}/></>}</View></View></Modal>}
      {cloudGuideOpen&&betaAccount.state.status==='eligible'&&<Modal transparent animationType="fade" onRequestClose={closeCloudGuide}><View style={styles.importModalShade}><ScrollView contentContainerStyle={styles.cloudGuideScroll}><CloudDataPanel guided store={saved.store} ready={saved.ready&&!saved.saving&&!saved.loadFailed&&!saved.error} userId={betaAccount.state.userId!} replaceStore={saved.recover} onCloudChanged={()=>void cloudSync.syncNow()}/><AppButton label="Done for now" secondary onPress={closeCloudGuide}/></ScrollView></View></Modal>}
      <View key={screen==='schoolDetail'?screen+selected.id:screen} style={styles.main}>
        {screen === "welcome" && renderWelcome()}
        {screen === "school" && renderSchool()}
        {screen === "schoolDetail" && renderSchoolDetail()}
        {screen === "schoolMore" && renderSchoolDetail(true)}
        {screen === "schoolSources" && renderSources()}
        {screen === "more" && renderMore()}
         {screen === "betaFeedback" && renderBetaFeedback()}
         {screen === "betaPrivacy" && renderBetaPrivacy()}
         {screen === "betaDashboard" && betaAdmin && <BetaDashboard onBack={()=>setScreen("more")}/>}
        {screen === "dataImport" && renderDataImport()}
        {(screen==='profile'||screen==='settings')&&<ScrollView contentContainerStyle={styles.scrollContent}><Pressable accessibilityRole="button" onPress={()=>setScreen('more')}><Text style={styles.back}>‹ More</Text></Pressable><Text style={styles.kicker}>{screen==='profile'?'ACCOUNT':'PREFERENCES & DATA'}</Text><Text style={styles.detailTitle}>{screen==='profile'?'Your account':'Your settings'}</Text>{screen==='profile'?<><BetaAccountPanel account={betaAccount}/><AppButton label="Export local backup" secondary onPress={exportLocalBackup}/>{betaAccount.state.status==='eligible'&&<CloudDataPanel store={saved.store} ready={saved.ready&&!saved.saving&&!saved.loadFailed&&!saved.error} userId={betaAccount.state.userId!} replaceStore={saved.recover}/>}</>:<><View style={styles.lessonCard}><Text style={styles.lessonTitle}>Plan-specific controls</Text><Text style={styles.nextText}>Dose units, schedule, reminder lead time, syringe capacity and inventory are maintained per peptide so one plan never silently changes another.</Text><AppButton label="Open My Peptides" onPress={()=>setScreen('plans')}/></View><View style={styles.lessonCard}><Text style={styles.lessonTitle}>My data & privacy</Text><Text style={styles.nextText}>Plans, calculations, event history and inventory are saved locally first. Invited accounts can use Cloud sync in Your account to move a verified copy between devices. Keep a private backup before clearing browser or app data.</Text><AppButton label="Import data from another app" onPress={chooseImportFile}/><AppButton label="Restore EZPep backup" secondary onPress={chooseBackupFile}/><AppButton label="Export local backup" secondary onPress={exportLocalBackup}/><Text style={styles.smallBadge}>Private export files are not uploaded automatically and may contain schedules and history. Cloud sync is a separate, explicit account action with revision checks and a local safety copy.</Text></View><View style={styles.lessonCard}><Text style={styles.sourceClass}>QUICK START</Text><Text style={styles.lessonTitle}>Restart onboarding</Text><Text style={styles.nextText}>Review the welcome questions and choose a new starting path. Your saved plans, history and settings will stay exactly as they are.</Text><AppButton label="Restart Quick Start Onboarding" secondary onPress={restartOnboarding}/></View><View style={styles.lessonCard}><Text style={styles.lessonTitle}>About EZPep Planner</Text><Text style={styles.nextText}>EZPep Planner 0.4 · Learn. Plan. Track.</Text><Text style={styles.smallBadge}>Educational planning support. Evidence classes and route/formulation limits remain attached to School content.</Text></View></>}<AppButton label="Back to More" secondary onPress={()=>setScreen('more')}/></ScrollView>}
        {screen === "guide" && renderGuide()}
        {screen === "detail" && renderDetail()}
        {screen==='activeEditor'&&focused&&currentEdit&&<ActivePeptideEditor key={focused.id+editorSection} initialSection={editorSection} plan={focused} edit={currentEdit} change={persistEdit} onSave={saveActiveEdits} onCancel={discardActiveEdits} onArchive={async()=>{const target=currentEdit.returnTo==='tracker'?'tracker':'plans';await saved.update(old=>({...archivePlan(old,focused.id),activeEdit:null}));setSessionEdit(null);setEditingActive(false);setScreen(target);}}/>}
        {screen==='plans'&&!saved.loadFailed&&<MyPlans store={saved.store} update={saved.update} onOpen={openPlan} onEdit={editPlan} onHistory={id=>{setSelectedPlanId(id);setScreen('planHistory');}} onDraft={()=>setScreen('plan')} onGuide={()=>setScreen('guide')}/>}
        {screen==='tracker'&&!plans.length&&!saved.loadFailed&&renderStartHere()}
        {(screen==='history'||(screen==='tracker'&&!!plans.length))&&!saved.loadFailed&&<AggregateTracker plans={plans} archives={saved.store.archives} update={saved.update} initialTab={screen==='history'?'History':'Today'} onOpen={openPlan} onEdit={editPlan}/>}
        {screen==='inventory'&&!saved.loadFailed&&<MyPlans inventory store={saved.store} update={saved.update} onOpen={id=>editPlan(id,'Inventory')} onEdit={editPlan} onHistory={id=>{setSelectedPlanId(id);setScreen('planHistory');}} onDraft={()=>setScreen('review')} onGuide={()=>setScreen('guide')}/>}
        {(["plan","planDetail","planInventory","review","schedule","calc","planTracker","planHistory","reminders"] as Screen[]).includes(screen) && !saved.loadFailed && <Workspace screen={(screen==='planDetail'?'plan':screen==='planInventory'?'inventory':screen==='planTracker'?'tracker':screen==='planHistory'?'history':screen) as any} navigate={workspaceNavigate} store={scopedStore} update={scopedUpdate} editing={editing?{onSave:saveActiveEdits,supply:currentEdit!.supplyVials,onSupplyChange:value=>persistEdit({...currentEdit!,supplyVials:value}).catch(()=>{})}:undefined} onStarted={()=>setScreen("plans")} onDiscard={editing?discardActiveEdits:async()=>{const compound=compounds.find(c=>c.id===saved.store.draft?.compoundId);await saved.update(old=>({...old,draft:null}));if(compound)setSelected(compound);setScreen("detail");}} onGuide={()=>setScreen("guide")}/>}
      </View>
      {screen!=="welcome"&&<BottomNav active={screen==='activeEditor'?(currentEdit?.returnTo??'plans'):screen} setScreen={setScreen} />}
    </SafeAreaView></SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  importModalShade:{flex:1,backgroundColor:'rgba(9,20,49,0.55)',alignItems:'center',justifyContent:'center',padding:24},
  cloudGuideScroll:{width:'100%',maxWidth:700,paddingVertical:24},
  importModalCard:{width:'100%',maxWidth:430,padding:22,borderRadius:24,backgroundColor:'#fff'},
  restoreDates:{marginTop:14,padding:12,gap:5,borderRadius:14,backgroundColor:COLORS.pale},
  restoreGood:{marginTop:12,color:'#176B45',fontSize:14,lineHeight:20,fontWeight:'700'},
  restoreError:{marginTop:12,color:'#A33A2B',fontSize:14,lineHeight:20,fontWeight:'700'},
  importModalTitle:{fontSize:27,lineHeight:33,fontWeight:'800',color:COLORS.ink,marginTop:5},
  welcomeContent:{paddingHorizontal:22,paddingTop:28,paddingBottom:40},
  welcomeBrand:{width:"100%",maxWidth:390,height:106,alignItems:"flex-start",justifyContent:"center",marginBottom:18},
  welcomeBrandImage:{width:"100%",height:"100%"},
  professorWelcomeCard:{flexDirection:"row",alignItems:"center",marginTop:18},
  professorWelcomeAvatar:{width:82,height:88,marginRight:14},
  professorWelcomeBubble:{flex:1,position:"relative",paddingHorizontal:16,paddingVertical:14,borderRadius:20,backgroundColor:COLORS.white,borderWidth:1,borderColor:"#B8D9EF",boxShadow:"0px 3px 8px rgba(14,28,74,0.10)"},
  professorBubbleTail:{position:"absolute",left:-8,top:28,width:16,height:16,backgroundColor:COLORS.white,borderLeftWidth:1,borderBottomWidth:1,borderColor:"#B8D9EF",transform:[{rotate:"45deg"}]},
  professorName:{color:"#5A42C7",fontSize:10,fontWeight:"800",letterSpacing:1.1,marginBottom:4},
  professorMessage:{color:COLORS.ink,fontSize:13,lineHeight:18,fontWeight:"700"},
  welcomeTitle:{color:COLORS.ink,fontSize:31,lineHeight:36,fontWeight:"800",marginTop:10},
  welcomeSub:{color:COLORS.muted,fontSize:15,lineHeight:22,marginTop:10},
  onboardingQuestion:{color:COLORS.ink,fontSize:18,fontWeight:"800",marginTop:26,marginBottom:10},
  choiceStack:{gap:9},
  choiceCard:{flexDirection:"row",alignItems:"center",gap:12,padding:14,borderWidth:1,borderColor:COLORS.border,borderRadius:17,backgroundColor:COLORS.white},
  choiceCardSelected:{borderColor:COLORS.blue,backgroundColor:COLORS.paleBlue,borderWidth:2},
  radio:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:"#A5B2C8"},
  radioSelected:{borderWidth:6,borderColor:COLORS.blue,backgroundColor:COLORS.white},
  choiceTitle:{color:COLORS.ink,fontSize:15,fontWeight:"800"},
  choiceDetail:{color:COLORS.muted,fontSize:12,lineHeight:17,marginTop:2},
  goalGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},
  goalCard:{width:"48%",minHeight:68,padding:12,borderRadius:16,borderWidth:1,borderColor:COLORS.border,justifyContent:"center",backgroundColor:COLORS.white},
  goalCardSelected:{borderColor:COLORS.purple,backgroundColor:COLORS.palePurple,borderWidth:2},
  goalText:{color:COLORS.ink,fontSize:13,fontWeight:"700",lineHeight:18},
  goalTextSelected:{color:"#5138BE"},
  skipButton:{alignItems:"center",padding:17},
  onboardingSafety:{color:COLORS.muted,fontSize:11,lineHeight:17,textAlign:"center",marginTop:16},
  startHero:{marginTop:16,minHeight:186,borderRadius:26,padding:20,backgroundColor:COLORS.paleBlue,borderWidth:1,borderColor:COLORS.border,overflow:"hidden"},
  startHeroCopy:{width:"63%",zIndex:1},
  professorStartGuide:{position:"absolute",right:-8,bottom:0,width:170,height:174},
  professorStartGuideCompact:{right:-18,width:135,height:150},
  guideSpeechBubble:{position:"absolute",right:155,bottom:20,width:300,paddingHorizontal:13,paddingVertical:10,borderRadius:16,backgroundColor:COLORS.white,borderWidth:1,borderColor:"#B8D9EF",boxShadow:"0px 2px 6px rgba(14,28,74,0.08)",zIndex:2},
  guideSpeechBubbleCompact:{position:"relative",right:0,bottom:0,width:"60%",marginTop:14,paddingRight:18},
  guideSpeechTail:{position:"absolute",right:-7,top:18,width:14,height:14,backgroundColor:COLORS.white,borderTopWidth:1,borderRightWidth:1,borderColor:"#B8D9EF",transform:[{rotate:"45deg"}]},
  pathLine:{position:"absolute",left:38,top:215,bottom:75,width:2,backgroundColor:COLORS.border},
  startStep:{flexDirection:"row",gap:14,padding:15,marginTop:11,borderWidth:1,borderColor:COLORS.border,borderRadius:18,backgroundColor:COLORS.white},
  startStepQuiet:{backgroundColor:COLORS.pale},
  startStepRecommended:{borderColor:COLORS.blue,borderWidth:2,backgroundColor:"#F2FBFF"},
  stepNumber:{width:32,height:32,borderRadius:16,backgroundColor:COLORS.palePurple,alignItems:"center",justifyContent:"center",zIndex:1},
  stepNumberText:{color:COLORS.purple,fontWeight:"800"},
  inlineAction:{alignSelf:"flex-start",paddingTop:8,paddingBottom:3},
  evidenceBadge: { borderLeftWidth: 4, padding: 14, borderRadius: 14, marginTop: 16, backgroundColor: COLORS.paleBlue },
  evidenceText: { color: COLORS.ink, fontWeight: "700", fontSize: 14, lineHeight: 21 },
  sourceClass: { color: "#286B9C", fontSize: 11, lineHeight: 16, fontWeight: "800", marginBottom: 6 },
  referenceStages: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  referenceStage: { minWidth: 66, borderRadius: 12, padding: 10, backgroundColor: COLORS.paleBlue },
  referenceAmount: { fontSize: 16, fontWeight: "800", color: COLORS.ink },
  consideration: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginBottom: 8 },
  originLabel: { fontSize: 13, lineHeight: 19, fontWeight: "700", color: COLORS.ink },
  schoolHeroCopy:{width:"63%",zIndex:1},
  schoolHeroCopyCompact:{width:"72%"},
  schoolHeroTitleCompact:{fontSize:30,lineHeight:34,marginTop:14},
  schoolSpeechBubble:{position:"absolute",right:120,bottom:24,width:270,paddingHorizontal:13,paddingVertical:10,borderRadius:16,backgroundColor:COLORS.white,borderWidth:1,borderColor:"#B8D9EF",boxShadow:"0px 2px 6px rgba(14,28,74,0.08)",zIndex:2},
  schoolSpeechBubbleCompact:{position:"relative",right:0,bottom:0,width:"62%",marginTop:14},
  schoolSpeechTail:{position:"absolute",right:-7,top:18,width:14,height:14,backgroundColor:COLORS.white,borderTopWidth:1,borderRightWidth:1,borderColor:"#B8D9EF",transform:[{rotate:"45deg"}]},
  schoolSpeechText:{color:COLORS.ink,fontSize:12,lineHeight:17,fontWeight:"700"},
  professorSchoolHero:{position:"absolute",right:5,bottom:3,width:132,height:185},
  professorSchoolHeroCompact:{right:0,bottom:4,width:104,height:154},
  schoolTabs:{flexDirection:"row",marginTop:8,marginBottom:10,padding:4,borderRadius:18,backgroundColor:"#EDF4FC",borderWidth:1,borderColor:COLORS.border},
  schoolTab:{flex:1,minHeight:42,paddingHorizontal:5,alignItems:"center",justifyContent:"center",borderRadius:14},
  schoolTabActive:{backgroundColor:COLORS.white,borderWidth:1,borderColor:"#B8D9EF",boxShadow:"0px 2px 5px rgba(14,28,74,0.10)"},
  schoolTabText:{fontSize:10,fontWeight:"700",color:COLORS.muted},
  schoolTabTextActive:{color:COLORS.ink,fontWeight:"800"},
  schoolSectionIntro:{marginTop:18,marginBottom:2},
  communityCard:{marginTop:18,padding:22,borderRadius:24,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.paleBlue},
  communityIcon:{width:52,height:52,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.white,marginBottom:16},
  communityIconText:{fontSize:30,color:COLORS.purple,fontWeight:"800"},
  schoolRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, marginBottom: 12, overflow:"hidden" },
  schoolOpen:{flex:1,flexDirection:"row",alignItems:"center",gap:16,padding:16},
  favoriteButton:{alignSelf:"stretch",width:48,alignItems:"center",justifyContent:"center",borderLeftWidth:StyleSheet.hairlineWidth,borderLeftColor:COLORS.border},
  favoriteIcon:{fontSize:25,color:"#91A0BC"},
  favoriteIconActive:{color:"#F2A31B"},
  schoolFilters:{gap:8,paddingTop:12,paddingBottom:2},
  schoolFilter:{paddingHorizontal:13,paddingVertical:9,borderRadius:16,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.white},
  schoolFilterActive:{backgroundColor:COLORS.palePurple,borderColor:"#B8A8FA"},
  schoolFilterText:{fontSize:11,fontWeight:"700",color:COLORS.muted},
  schoolFilterTextActive:{color:"#5A42C7"},
  smallBadge: { color: COLORS.muted, fontSize: 11, marginTop: 6 },
  linkArrow: { color: COLORS.blue, fontSize: 26 },
  emptyText: { color: COLORS.muted, paddingVertical: 24, textAlign: "center" },
  notice: { padding: 14, backgroundColor: COLORS.palePurple, borderRadius: 16, marginTop: 16 },
  noticeText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  crossLink: { alignSelf: "flex-start", paddingVertical: 14 },
  crossLinkText: { color: "#126EA5", fontSize: 15, fontWeight: "700" },
  lessonCard: { padding: 16, marginTop: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18 },
  lessonTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 16, marginBottom: 7 },
  moreRow: { padding: 17, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, marginTop: 12 },
  previewRow: { marginTop: 14, gap: 8 },
  safe: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center", backgroundColor: COLORS.white },
  main: { flex: 1 },
  topLine: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  saveSyncRow:{paddingHorizontal:20,paddingVertical:5,minHeight:42,flexDirection:"row",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:8},
  syncButton:{minHeight:34,paddingHorizontal:11,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.paleBlue,borderWidth:1,borderColor:COLORS.border},
  syncButtonAttention:{backgroundColor:"#FFF4E5",borderColor:"#E7A44A"},
  syncButtonText:{color:COLORS.ink,fontSize:12,fontWeight:"800"},
  tempBrand: { color: COLORS.ink, fontWeight: "800", letterSpacing: 1.2, fontSize: 12 },
  brandLockup: { width: 218, height: 60, flexShrink: 1, minWidth: 0, alignItems: "flex-start", justifyContent: "center" },
  brandLockupImage: { width: "100%", height: "100%" },
  tempStatus: { color: COLORS.muted, fontSize: 11 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 28 },
  hero: { marginTop: 16, borderRadius: 28, padding: 20, overflow: "hidden", backgroundColor: COLORS.pale, borderWidth: 1, borderColor: COLORS.border },
  heroBubbleOne: { position: "absolute", width: 150, height: 150, borderRadius: 75, right: -35, top: -45, backgroundColor: "#D8F4FF" },
  heroBubbleTwo: { position: "absolute", width: 110, height: 110, borderRadius: 55, right: 50, top: 20, backgroundColor: "#E8DEFF", opacity: 0.7 },
  kicker: { color: COLORS.blue, fontSize: 12, fontWeight: "800", letterSpacing: 1.7 },
  heroTitle: { color: COLORS.ink, fontSize: 34, lineHeight: 38, fontWeight: "800", marginTop: 18 },
  heroSub: { color: COLORS.muted, fontSize: 16, marginTop: 8 },
  featureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  featureItem: { flexDirection: "row", alignItems: "center", width: "31%" },
  featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.paleBlue, marginRight: 8 },
  featureIconText: { color: COLORS.blue, fontWeight: "800" },
  featureText: { color: COLORS.ink, fontSize: 11, fontWeight: "700", lineHeight: 14 },
  searchWrap: { flexDirection: "row", alignItems: "center", marginTop: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 16, backgroundColor: COLORS.white },
  searchIcon: { fontSize: 26, color: COLORS.ink },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: 10, color: COLORS.ink },
  filterIcon: { fontSize: 18, color: COLORS.ink },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800" },
  sectionLink: { color: COLORS.muted, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  compoundCard: { width: "48%", minHeight: 230, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, backgroundColor: COLORS.white, padding: 14, overflow: "hidden" },
  molecule: { width: 68, height: 72, alignSelf: "center", marginBottom: 6 },
  atom: { position: "absolute", width: 24, height: 24, borderRadius: 12 },
  atomSmall: { position: "absolute", width: 18, height: 18, borderRadius: 9, opacity: 0.9 },
  atomTiny: { position: "absolute", width: 14, height: 14, borderRadius: 7, opacity: 0.75 },
  bond: { position: "absolute", width: 28, height: 3, borderRadius: 3, opacity: 0.45 },
  bondVertical: { position: "absolute", width: 3, height: 22, borderRadius: 3, opacity: 0.45 },
  compoundName: { color: COLORS.ink, fontSize: 18, fontWeight: "800", lineHeight: 20 },
  compoundSub: { color: COLORS.muted, fontSize: 12, marginTop: 5, minHeight: 30 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: COLORS.paleBlue, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: "#2373C9", fontSize: 10, fontWeight: "700" },
  cardArrow: { position: "absolute", right: 12, bottom: 12, color: "#174FCE", fontSize: 26, fontWeight: "700" },
  banner: { marginTop: 14, borderRadius: 18, backgroundColor: COLORS.paleBlue, padding: 16, flexDirection: "row", alignItems: "center" },
  bannerIcon: { color: COLORS.blue, fontSize: 24, marginRight: 10 },
  bannerTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "800" },
  bannerSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  back: { color: COLORS.blue, fontSize: 15, fontWeight: "700", marginTop: 14, marginBottom: 10 },
  detailTitle: { color: COLORS.ink, fontSize: 30, fontWeight: "800" },
  detailMeta: { color: COLORS.muted, fontSize: 14, marginTop: 3 },
  detailHero: { marginTop: 18, borderRadius: 24, padding: 18, minHeight: 190, backgroundColor: COLORS.paleBlue, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  detailHeroTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", lineHeight: 25 },
  detailHeroBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  helper: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 5, marginBottom: 8 },
  planOption: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", marginTop: 10, backgroundColor: COLORS.white },
  planBars: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  planBarsText: { fontSize: 22, fontWeight: "800" },
  planOptionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "800" },
  planOptionSub: { color: COLORS.muted, fontSize: 12, marginTop: 3, paddingRight: 18 },
  button: { marginTop: 20, minHeight: 52, borderRadius: 17, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonSecondary: { backgroundColor: COLORS.paleBlue, borderWidth: 1, borderColor: COLORS.border },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: "800" },
  buttonTextSecondary: { color: COLORS.ink },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  summaryBox: { flex: 1, backgroundColor: COLORS.paleBlue, borderRadius: 18, padding: 14, alignItems: "center" },
  summaryBig: { color: COLORS.ink, fontSize: 24, fontWeight: "800" },
  summarySmall: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  timelineWrap: { marginTop: 18 },
  timelineRow: { flexDirection: "row", minHeight: 148 },
  timelineRail: { width: 32, alignItems: "center" },
  timelineDot: { width: 18, height: 18, borderRadius: 9, marginTop: 16 },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },
  stageCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 14, marginBottom: 12 },
  stageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stageTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "800" },
  stageWeeks: { color: COLORS.muted, fontSize: 12 },
  stageInputs: { flexDirection: "row", gap: 10, marginTop: 12 },
  inputLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  smallInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.ink, fontSize: 16, backgroundColor: COLORS.white },
  addStage: { borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 16, padding: 15, alignItems: "center" },
  addStageText: { color: COLORS.blue, fontWeight: "800" },
  breakCard: { gap: 12, flexWrap: "wrap", marginTop: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: { minWidth: 44, minHeight: 44, textAlign: "center", textAlignVertical: "center", color: COLORS.blue, fontSize: 23, fontWeight: "800" },
  stepperValue: { color: COLORS.ink, fontWeight: "800" },
  formCard: { marginTop: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16 },
  formSection: { color: COLORS.ink, fontSize: 17, fontWeight: "800", marginBottom: 12 },
  inputUnitRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  largeInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: COLORS.ink },
  unit: { paddingHorizontal: 14, color: COLORS.muted, fontWeight: "700" },
  concentrationCard: { marginTop: 14, backgroundColor: COLORS.paleBlue, borderRadius: 18, padding: 16, alignItems: "center" },
  concentration: { color: "#1189C2", fontSize: 24, fontWeight: "800" },
  syringeCard: { marginTop: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16, alignItems: "center" },
  syringeLabel: { color: COLORS.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  syringeBig: { color: COLORS.ink, fontSize: 31, fontWeight: "800", marginTop: 4 },
  syringeMeta: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  syringe: { height: 95, width: "100%", marginTop: 26, flexDirection: "row", alignItems: "center" },
  syringePlunger: { width: 24, height: 46, borderWidth: 2, borderColor: "#9EABC0", backgroundColor: "#D5DDE9", borderRadius: 5 },
  syringeBarrel: { flex: 1, height: 48, borderWidth: 2, borderColor: "#9EABC0", backgroundColor: COLORS.white, position: "relative" },
  syringeFill: { height: "100%", backgroundColor: "#CBEFFF" },
  drawLine: { position: "absolute", top: -19, width: 3, height: 84, backgroundColor: COLORS.blue, marginLeft: -1.5 },
  tickGroup: { position: "absolute", top: 0, height: 48, width: 1 },
  tick: { width: 1, height: 11, backgroundColor: "#65728A" },
  tickText: { position: "absolute", top: 29, left: -7, width: 18, textAlign: "center", fontSize: 8, color: COLORS.muted },
  syringeNeedle: { width: 35, height: 2, backgroundColor: "#7A879A" },
  drawCallout: { marginTop: 12, backgroundColor: COLORS.paleBlue, borderRadius: 14, padding: 12, width: "100%" },
  drawCalloutText: { color: COLORS.ink, textAlign: "center", fontSize: 13, fontWeight: "700" },
  safetyNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: "center" },
  progressCard: { marginTop: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 17 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressBig: { color: COLORS.ink, fontSize: 23, fontWeight: "800" },
  percentCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 8, borderColor: COLORS.blue, alignItems: "center", justifyContent: "center" },
  percentText: { color: COLORS.ink, fontWeight: "800" },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: "#E7EDF6", overflow: "hidden", marginTop: 18 },
  progressFill: { height: "100%", backgroundColor: COLORS.purple },
  threeStats: { flexDirection: "row", gap: 8, marginTop: 16 },
  stat: { flex: 1, backgroundColor: COLORS.pale, borderRadius: 15, padding: 10, alignItems: "center" },
  statBig: { color: COLORS.ink, fontSize: 19, fontWeight: "800" },
  statSmall: { color: COLORS.muted, fontSize: 10, marginTop: 2, textAlign: "center" },
  todayCard: { marginTop: 14, borderRadius: 22, padding: 17, backgroundColor: COLORS.palePurple },
  todaySub: { color: COLORS.muted, fontSize: 12 },
  todayBig: { color: COLORS.ink, fontSize: 30, fontWeight: "800", marginTop: 3 },
  todayMeta: { color: COLORS.muted, fontSize: 13 },
  nextCard: { marginTop: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16 },
  nextText: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  nav: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, backgroundColor: COLORS.white, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 4, minHeight: 88 },
  todayDestination: { backgroundColor: COLORS.paleBlue, borderRadius: 15, borderWidth: 1, borderColor: COLORS.blue, marginHorizontal: 3 },
  todayDestinationActive: { backgroundColor: "#d8f2ff", borderWidth: 2 },
  todayInk: { color: "#087ba5", fontWeight: "800" },
  iconWell: {width:44,height:40,borderRadius:13,alignItems:"center",justifyContent:"center"},
  navArtWell:{width:52,height:48,borderRadius:15,alignItems:"center",justifyContent:"center"},
  todayArtWell:{width:62,height:60,marginTop:-9},
  navArtWellSelected:{transform:[{scale:1.06}],boxShadow:"0px 3px 8px rgba(32,101,190,0.18)"},
  todayCircle: {width:56,height:56,borderRadius:28,marginTop:-6,backgroundColor:"#06aacc",alignItems:"center",justifyContent:"center",boxShadow:"0px 3px 8px rgba(6,170,204,0.25)"},
  todayCircleSelected: {backgroundColor:"#009ebb",borderWidth:3,borderColor:"#a2eef6"},
  navItem: { minHeight: 64, flex: 1, alignItems: "center", justifyContent: "center" },
  navIcon: { color: "#7B8AA6", fontSize: 20, fontWeight: "700" },
  navLabel: { color: "#7B8AA6", fontSize: 9, marginTop: 2 },
  navActive: { color: COLORS.blue },
});

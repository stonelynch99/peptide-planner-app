export type SchoolBasicSection={id:string;title:string;summary:string;details:string[];sourceLabels:string[]};

export const reconstitutionBasics:SchoolBasicSection={
 id:'reconstitution-basics',
 title:'Before you begin: vials, diluent & reconstitution',
 summary:'A quick primer on the words you will see in School and the calculator.',
 details:[
  'Lyophilized means freeze-dried. A lyophilized vial contains dry material that must be dissolved with an appropriate diluent when the product or research setup calls for reconstitution.',
  'Reconstitution means adding a specified liquid (diluent) to dry material to create a solution of known concentration. The correct diluent is product-specific; do not assume every vial uses the same liquid.',
  'Bacteriostatic Water for Injection, USP is sterile water for injection containing a bacteriostatic preservative such as benzyl alcohol and is supplied as a multiple-dose diluent. Sterile Water for Injection is preservative-free and is not interchangeable in every product or use case.',
  'Do not choose a diluent because it is cheaper or sold online. Use only a sterile, appropriately labelled diluent that is compatible with the specific product or reference being modelled.',
  'Concentration is simple arithmetic: amount in the vial ÷ liquid volume. Example for learning the math only: 10 mg in 1 mL = 10 mg/mL. On a U-100 syringe, 1 unit = 0.01 mL, so that concentration contains 0.1 mg per U-100 unit.',
  'Changing the liquid volume changes the concentration and therefore changes the syringe volume needed to represent the same amount. The planner keeps vial strength, diluent volume, amount and syringe units connected so you do not have to do that conversion mentally.'
 ],
 sourceLabels:['DailyMed: Bacteriostatic Water for Injection, USP','FDA-approved product labelling examples for reconstitution of lyophilized drug products']
};

export const schoolBasics=[reconstitutionBasics];

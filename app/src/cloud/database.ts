export type Json = string | number | boolean | null | {[key:string]:Json|undefined} | Json[];
type Table<Row, Insert=Partial<Row>> = {Row:Row;Insert:Insert;Update:Partial<Insert>;Relationships:[]};
export type Database = { public: {
  Tables: {
    account_deletion_requests: Table<{user_id:string;status:string;requested_at:string;updated_at:string}>;
    profiles: Table<{user_id:string;created_at:string;updated_at:string}>;
    planner_state: Table<{user_id:string;snapshot:Json;schema_version:number;revision:number;created_at:string;updated_at:string}>;
    consent_records: Table<{id:string;user_id:string;consent_version:string;acknowledged_at:string}, {user_id:string;consent_version:string}>;
    beta_feedback: Table<{id:string;user_id:string;category:string;message:string;app_version:string;origin:string;platform:string;browser:string;include_plan_details:boolean;detail_payload:Json;created_at:string}, {user_id:string;category:string;message:string;app_version:string;origin:string;platform:string;browser:string;include_plan_details:boolean;detail_payload:Json}>;
  };
  Views: {[key in never]:never};
  Functions: { beta_access: {Args:Record<string,never>;Returns:boolean}; beta_admin_access:{Args:Record<string,never>;Returns:boolean}; beta_admin_dashboard:{Args:Record<string,never>;Returns:Json}; accept_beta_invite: {Args:Record<string,never>;Returns:boolean}; create_initial_planner_copy:{Args:{payload:Json;confirmed:boolean;expected_user_id:string};Returns:number}; export_own_account:{Args:Record<string,never>;Returns:Json}; set_deletion_request:{Args:{cancel_request:boolean};Returns:string}; sync_planner_snapshot:{Args:{payload:Json;expected_revision:number;expected_user_id:string};Returns:number} };
  Enums: {[key in never]:never}; CompositeTypes: {[key in never]:never};
}};

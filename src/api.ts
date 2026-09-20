/* eslint-disable @typescript-eslint/no-explicit-any */
export type Session={token:string;user:{id:number;campus_id:number;full_name:string;email:string;role:"admin"|"teacher"|"parent"}};
export type Bootstrap={classes:any[];students:any[];parents:any[];teachers:any[];exercises:any[];fields:any[];lessons:any[];templates:any[];rounds:any[];results:any[];children:any[]};

async function request(path:string,options:RequestInit={}){
  const response=await fetch(`/api${path}`,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const payload=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.message||"Không thể kết nối máy chủ");
  return payload;
}
export const publicApi={
  login:(email:string,password:string)=>request("/auth/login",{method:"POST",body:JSON.stringify({email,password})}) as Promise<Session>,
  register:(data:unknown)=>request("/registrations",{method:"POST",body:JSON.stringify(data)}),
};
export function createApi(token:string){const headers={Authorization:`Bearer ${token}`};return {
  bootstrap:()=>request("/bootstrap",{headers}) as Promise<Bootstrap>,
  get:(resource:string,id:number)=>request(`/${resource}/${id}`,{headers}),
  create:(resource:string,data:unknown)=>request(`/${resource}`,{method:"POST",headers,body:JSON.stringify(data)}),
  update:(resource:string,id:number,data:unknown)=>request(`/${resource}/${id}`,{method:"PUT",headers,body:JSON.stringify(data)}),
  setTemplateExercises:(id:number,exercise_ids:number[])=>request(`/templates/${id}/exercises`,{method:"PUT",headers,body:JSON.stringify({exercise_ids})}),
  setStudentParent:(id:number,parent_id:number|null,relationship="Phụ huynh")=>request(`/students/${id}/parent`,{method:"PUT",headers,body:JSON.stringify({parent_id,relationship})}),
  setLessonExercises:(id:number,exercise_ids:number[])=>request(`/lessons/${id}/exercises`,{method:"PUT",headers,body:JSON.stringify({exercise_ids})}),
  remove:(resource:string,id:number)=>request(`/${resource}/${id}`,{method:"DELETE",headers}),
  saveResult:(data:unknown)=>request("/results",{method:"POST",headers,body:JSON.stringify(data)}),
  publishResult:(id:number)=>request(`/results/${id}/publish`,{method:"PATCH",headers}),
  childResults:(id:number)=>request(`/parent/children/${id}/results`,{headers}),
};}

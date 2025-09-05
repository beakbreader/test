/* Shared calculator logic for generated pages */
export const calculators = {
  molarity: {
    compute: ({moles, volumeL, grams, mm, mode})=>{
      const V = Number(volumeL);
      if (!isFinite(V) || V<=0) return {ok:false,msg:"Enter a valid volume in liters."};
      let n;
      if (mode==="grams"){
        const g=Number(grams), M=Number(mm);
        if(!isFinite(g)||g<0) return {ok:false,msg:"Enter grams ≥ 0."};
        if(!isFinite(M)||M<=0) return {ok:false,msg:"Enter molar mass > 0."};
        n=g/M;
      } else {
        n=Number(moles);
        if(!isFinite(n)||n<0) return {ok:false,msg:"Enter moles ≥ 0."};
      }
      const M = n/V;
      return {ok:true,value:`${Number(M.toPrecision(6))} mol·L⁻¹`,work:`M = n/V = ${n} / ${V}`};
    }
  },
  dilution: {
    compute: ({m1,v1,m2,v2,target})=>{
      const N = (x)=>Number(x);
      if(target==="M1"){ if(!v1||!m2||!v2) return {ok:false,msg:"Fill V1, M2, V2."}; return {ok:true,value:String(N(m2)*N(v2)/N(v1))}; }
      if(target==="V1"){ if(!m1||!m2||!v2) return {ok:false,msg:"Fill M1, M2, V2."}; return {ok:true,value:String(N(m2)*N(v2)/N(m1))}; }
      if(target==="M2"){ if(!m1||!v1||!v2) return {ok:false,msg:"Fill M1, V1, V2."}; return {ok:true,value:String(N(m1)*N(v1)/N(v2))}; }
      if(target==="V2"){ if(!m1||!v1||!m2) return {ok:false,msg:"Fill M1, V1, M2."}; return {ok:true,value:String(N(m1)*N(v1)/N(m2))}; }
      return {ok:false,msg:"Choose an unknown to solve."};
    }
  },
  molality: {
    compute: ({moles, kg})=>{
      const n=Number(moles), m=Number(kg);
      if(!isFinite(n)||n<0) return {ok:false,msg:"Enter moles ≥ 0."};
      if(!isFinite(m)||m<=0) return {ok:false,msg:"Enter solvent mass in kg > 0."};
      const res = n/m;
      return {ok:true,value:`${Number(res.toPrecision(6))} mol·kg⁻¹`,work:`m = n/kg = ${n}/${m}`};
    }
  },
  quadratic: {
    compute: ({a,b,c})=>{
      const A=Number(a),B=Number(b),C=Number(c);
      if(![A,B,C].every(x=>isFinite(x))) return {ok:false,msg:"Enter valid numbers a, b, c."};
      const D=B*B-4*A*C;
      if(A===0) return {ok:false,msg:"a ≠ 0 for a quadratic."};
      if(D<0){ const rp=(-B)/(2*A), ip=Math.sqrt(-D)/(2*A); return {ok:true,value:`x = ${rp.toFixed(6)} ± ${ip.toFixed(6)}i`,work:`Δ = ${D}`}; }
      const r1=(-B+Math.sqrt(D))/(2*A), r2=(-B-Math.sqrt(D))/(2*A);
      return {ok:true,value:`x₁ = ${r1}, x₂ = ${r2}`,work:`Δ = ${D}`};
    }
  },
  ohms: {
    compute: ({target,V,I,R})=>{
      const n=(x)=>Number(x);
      if(target==="V"){ if(!I||!R) return {ok:false,msg:"Enter I and R."}; return {ok:true,value:`${n(I)*n(R)} V`}; }
      if(target==="I"){ if(!V||!R) return {ok:false,msg:"Enter V and R."}; return {ok:true,value:`${n(V)/n(R)} A`}; }
      if(target==="R"){ if(!V||!I) return {ok:false,msg:"Enter V and I."}; return {ok:true,value:`${n(V)/n(I)} Ω`}; }
      return {ok:false,msg:"Select a quantity to solve."};
    }
  }
};

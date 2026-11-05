"""CMS, CY 2027 OPPS final rule, Table 112 (PI pp. 1223-1225), and the rule that puts an impact-file row in its groups.

TABLE: group -> (number of hospitals, col 4 340B adjustment %, col 7 all CY 2027 changes %, col 8 remedy offset %).
"""

TABLE = {
'ALL':(3502,-0.1,1.7,-2.0),'URBAN':(2837,-0.5,1.3,-2.0),'LURBAN':(1342,-0.8,0.8,-2.0),'OURBAN':(1495,-0.2,1.7,-2.0),
'RURAL':(665,3.3,5.3,-2.0),'RSCH':(324,5.3,7.7,-2.0),'ROTHER':(341,0.0,1.4,-2.0),
'UB0-99':(1004,4.5,7.1,-1.8),'UB100-199':(787,2.7,5.2,-2.0),'UB200-299':(425,1.8,3.9,-2.0),'UB300-499':(387,0.5,2.3,-2.0),'UB500+':(234,-4.8,-3.7,-2.0),
'RB0-49':(309,4.3,6.9,-2.0),'RB50-100':(203,3.8,6.0,-2.0),'RB101-149':(87,1.6,3.0,-2.0),'RB150-199':(36,3.5,5.3,-2.0),'RB200+':(30,2.6,4.4,-2.0),
'NONTEACH':(2081,3.5,6.0,-1.9),'MINOR':(955,0.8,2.8,-2.0),'MAJOR':(466,-3.9,-2.7,-2.0),
'DSH0':(11,7.4,10.5,-0.7),'DSH0-10':(254,6.5,9.5,-1.9),'DSH10-16':(263,6.3,9.2,-1.9),'DSH16-23':(546,5.6,8.3,-2.0),'DSH23-35':(1135,-0.8,0.9,-2.0),'DSH35+':(743,-5.2,-4.2,-2.0),'DSHNA':(550,6.4,12.7,-1.9),
'VOL':(1989,-0.4,1.4,-2.0),'PROP':(1106,6.8,10.1,-1.9),'GOV':(407,-2.9,-1.7,-2.0),
'U-NE':(122,-0.8,0.7,-2),'U-MA':(300,-1.1,0.7,-2),'U-SA':(474,-0.1,2.3,-1.9),'U-ENC':(426,-0.7,1.2,-2),'U-ESC':(177,-2.6,-1.8,-2),'U-WNC':(182,-1.6,-0.6,-2),'U-WSC':(478,1.4,3.6,-2),'U-MNT':(239,1.0,2.6,-1.9),'U-PAC':(387,-0.6,1.1,-2),'U-PR':(52,4.5,5.4,0.0),
'R-NE':(20,3.8,6.2,-2),'R-MA':(45,1.4,3.2,-2),'R-SA':(109,2.8,5.3,-2),'R-ENC':(110,3.1,5.4,-2),'R-ESC':(124,1.0,2.0,-2),'R-WNC':(72,5.1,6.1,-2),'R-WSC':(121,4.7,6.9,-2),'R-MNT':(39,5.2,6.7,-1.9),'R-PAC':(24,2.9,7.6,-2),'R-PR':(1,9.3,9.8,0.0),
}
def groups(v):
    """Table 112 group keys for one impact-file row."""
    g=['ALL']; geo=v['geo']; beds=int(float(v['beds'] or 0))
    reg=v['region']; sch=v['rural_sch']=='1'
    urban=geo in ('LURBAN','OURBAN')
    if urban:
        g+=['URBAN',geo]; g.append('UB0-99' if beds<100 else 'UB100-199' if beds<200 else 'UB200-299' if beds<300 else 'UB300-499' if beds<500 else 'UB500+')
        g.append('U-'+reg)
    else:
        g+=['RURAL','RSCH' if sch else 'ROTHER']; g.append('RB0-49' if beds<50 else 'RB50-100' if beds<=100 else 'RB101-149' if beds<150 else 'RB150-199' if beds<200 else 'RB200+')
        g.append('R-'+reg)
    t=v['teaching']; g.append({'NONE':'NONTEACH','MINOR':'MINOR','MAJOR':'MAJOR'}.get(t,'NONTEACH'))
    d=v['dsh_pct']
    if d=='': g.append('DSHNA')
    else:
        x=float(d)
        g.append('DSH0' if x==0 else 'DSH0-10' if x<0.10 else 'DSH10-16' if x<0.16 else 'DSH16-23' if x<0.23 else 'DSH23-35' if x<0.35 else 'DSH35+')
    g.append({'1':'VOL','2':'PROP','3':'GOV'}.get(v['ownership']))
    return g

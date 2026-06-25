#include<bits/stdc++.h>
using namespace std;
int fastpow(int a,int b,int p)
{
    int res=1;
    while(b)
    {
        if(b&1) res=(res*a)%p;
        a=(a*a)%p;
        b>>=1;
    }
    return res;
}
int main(){
    cout<<fastpow(2,3,1000000007)<<endl;
    return 0;
}